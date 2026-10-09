-- Store Stripe Connect links privately and record verified, idempotent webhooks.
-- Apply after the core schema and before security-hardening.sql.
CREATE TABLE IF NOT EXISTS public.business_payment_accounts (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_payment_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_payment_accounts TO service_role;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_payment_intent_uidx
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_bizpilot_stripe_payment(
  target_invoice_id uuid,
  target_business_id uuid,
  payment_amount numeric,
  payment_method text,
  target_stripe_payment_intent_id text,
  target_currency_code text,
  target_stripe_account_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expected_account text;
  business_currency text;
  invoice_customer_id uuid;
  invoice_total numeric(12,2);
  invoice_paid numeric(12,2);
  prior_payment public.payments%ROWTYPE;
  inserted_rows integer;
  rounded_amount numeric(12,2);
BEGIN
  IF target_stripe_payment_intent_id IS NULL OR target_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Invalid Stripe payment intent';
  END IF;
  IF payment_method NOT IN ('upi','card','bank_transfer','other') THEN
    RAISE EXCEPTION 'Invalid Stripe payment method';
  END IF;
  IF payment_amount IS NULL OR payment_amount <= 0 OR payment_amount > 9999999999 THEN
    RAISE EXCEPTION 'Payment amount must be positive and within range';
  END IF;
  rounded_amount := round(payment_amount, 2);
  IF rounded_amount <= 0 THEN RAISE EXCEPTION 'Payment amount is below the supported precision'; END IF;

  SELECT a.stripe_account_id INTO expected_account
    FROM public.business_payment_accounts AS a
    WHERE a.business_id = target_business_id;
  IF expected_account IS NULL OR expected_account <> target_stripe_account_id THEN
    RAISE EXCEPTION 'Stripe account is not connected to this business';
  END IF;
  SELECT b.currency_code INTO business_currency
    FROM public.businesses AS b WHERE b.id = target_business_id;
  IF business_currency IS NULL OR upper(target_currency_code) <> business_currency THEN
    RAISE EXCEPTION 'Payment currency does not match this business';
  END IF;

  SELECT * INTO prior_payment FROM public.payments AS p
    WHERE p.stripe_payment_intent_id = target_stripe_payment_intent_id;
  IF FOUND THEN
    IF prior_payment.business_id = target_business_id
      AND prior_payment.invoice_id = target_invoice_id
      AND prior_payment.stripe_account_id = target_stripe_account_id
      AND prior_payment.amount = rounded_amount THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Stripe payment intent was already recorded with different details';
  END IF;

  SELECT i.customer_id, i.total, i.paid_amount
    INTO invoice_customer_id, invoice_total, invoice_paid
    FROM public.invoices AS i
    WHERE i.id = target_invoice_id AND i.business_id = target_business_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found for this business'; END IF;
  IF rounded_amount > invoice_total - invoice_paid THEN
    RAISE EXCEPTION 'Payment exceeds the remaining invoice balance';
  END IF;

  INSERT INTO public.payments(
    business_id, invoice_id, customer_id, amount, method, paid_at,
    stripe_payment_intent_id, stripe_account_id
  ) VALUES (
    target_business_id, target_invoice_id, invoice_customer_id, rounded_amount, payment_method, now(),
    target_stripe_payment_intent_id, target_stripe_account_id
  ) ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 0 THEN RETURN; END IF;

  UPDATE public.invoices
    SET paid_amount = invoice_paid + rounded_amount,
        status = CASE WHEN invoice_paid + rounded_amount >= invoice_total THEN 'paid' ELSE 'partially_paid' END,
        updated_at = now()
    WHERE id = target_invoice_id AND business_id = target_business_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_bizpilot_stripe_payment(uuid, uuid, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bizpilot_stripe_payment(uuid, uuid, numeric, text, text, text, text) TO service_role;
