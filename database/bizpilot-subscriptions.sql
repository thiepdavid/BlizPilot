-- BizPilot's own SaaS subscription records. Separate from Stripe Connect,
-- which processes each business's customer payments.
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_key text NOT NULL CHECK (plan_key = 'pro'),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status text NOT NULL,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id text NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_event_created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bizpilot_subscription_events (
  event_id text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_created_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bizpilot_subscription_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_subscriptions, public.bizpilot_subscription_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_subscriptions,
  public.bizpilot_subscription_events TO service_role;

CREATE OR REPLACE FUNCTION public.sync_bizpilot_subscription(
  target_event_id text,
  target_event_created_at timestamptz,
  target_business_id uuid,
  target_customer_id text,
  target_subscription_id text,
  target_price_id text,
  target_interval text,
  target_status text,
  target_current_period_end timestamptz,
  target_cancel_at_period_end boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_event integer;
  applied_subscription integer;
BEGIN
  IF target_event_id IS NULL OR target_event_id !~ '^evt_[A-Za-z0-9]+$'
    OR target_event_created_at IS NULL OR target_business_id IS NULL
    OR target_customer_id IS NULL OR target_customer_id !~ '^cus_[A-Za-z0-9]+$'
    OR target_subscription_id IS NULL OR target_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    OR target_price_id IS NULL OR target_price_id !~ '^price_[A-Za-z0-9]+$'
    OR target_interval IS NULL OR target_interval NOT IN ('month', 'year')
    OR target_status IS NULL OR target_status NOT IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
    OR target_current_period_end IS NULL OR target_cancel_at_period_end IS NULL THEN
    RAISE EXCEPTION 'Invalid BizPilot subscription event';
  END IF;

  INSERT INTO public.bizpilot_subscription_events(event_id, business_id, event_created_at)
    VALUES (target_event_id, target_business_id, target_event_created_at)
    ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_event = ROW_COUNT;
  IF inserted_event = 0 THEN RETURN false; END IF;

  INSERT INTO public.business_subscriptions(
    business_id, plan_key, billing_interval, status, stripe_customer_id,
    stripe_subscription_id, stripe_price_id, current_period_end,
    cancel_at_period_end, stripe_event_created_at, updated_at
  ) VALUES (
    target_business_id, 'pro', target_interval, target_status, target_customer_id,
    target_subscription_id, target_price_id, target_current_period_end,
    target_cancel_at_period_end, target_event_created_at, now()
  )
  ON CONFLICT (business_id) DO UPDATE SET
    plan_key = EXCLUDED.plan_key,
    billing_interval = EXCLUDED.billing_interval,
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    stripe_event_created_at = EXCLUDED.stripe_event_created_at,
    updated_at = now()
  WHERE public.business_subscriptions.stripe_event_created_at <= EXCLUDED.stripe_event_created_at;
  GET DIAGNOSTICS applied_subscription = ROW_COUNT;
  RETURN applied_subscription > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_bizpilot_subscription(text, timestamptz, uuid, text, text, text, text, text, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_bizpilot_subscription(text, timestamptz, uuid, text, text, text, text, text, timestamptz, boolean)
  TO service_role;
