-- BizPilot core database bootstrap for a NEW Supabase project.
-- Never run this blindly against the existing production database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  currency_code text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_users (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 160),
  email text,
  phone text,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, business_id)
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description text,
  duration_minutes integer NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 1 AND 1440),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, business_id)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  service_name text NOT NULL DEFAULT 'Service',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 1 AND 1440),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, business_id) REFERENCES public.customers(id, business_id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  invoice_number text NOT NULL,
  description text NOT NULL DEFAULT '',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(line_items) = 'array'),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total),
  due_date date,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft','sent','paid','partially_paid','overdue','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (customer_id, business_id) REFERENCES public.customers(id, business_id) ON DELETE RESTRICT,
  UNIQUE (id, business_id),
  UNIQUE (business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('cash','upi','card','bank_transfer','other')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, business_id) REFERENCES public.invoices(id, business_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id, business_id) REFERENCES public.customers(id, business_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 240),
  category text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  spent_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  channel text NOT NULL DEFAULT 'other',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_business_created_idx ON public.customers (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS services_business_active_idx ON public.services (business_id, is_active, name);
CREATE INDEX IF NOT EXISTS appointments_business_start_idx ON public.appointments (business_id, starts_at);
CREATE INDEX IF NOT EXISTS invoices_business_created_idx ON public.invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_business_paid_idx ON public.payments (business_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS expenses_business_spent_idx ON public.expenses (business_id, spent_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_business_created_idx ON public.campaigns (business_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_bizpilot_business_member(target_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_users AS member
    WHERE member.business_id = target_business_id AND member.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_bizpilot_business_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bizpilot_business_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_bizpilot_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  person_name text;
  business_name text;
  new_business_id uuid;
BEGIN
  person_name := left(coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(NEW.email, ''), '@', 1), 'Business owner'), 120);
  business_name := left(coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'business_name'), ''), person_name || '''s business'), 160);
  INSERT INTO public.users (id, full_name, email)
  VALUES (NEW.id, person_name, NEW.email)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, updated_at = now();
  INSERT INTO public.businesses (owner_id, name)
  VALUES (NEW.id, business_name)
  RETURNING id INTO new_business_id;
  INSERT INTO public.business_users (business_id, user_id, role)
  VALUES (new_business_id, NEW.id, 'owner');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_bizpilot_signup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_bizpilot ON auth.users;
CREATE TRIGGER on_auth_user_created_bizpilot
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_bizpilot_signup();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_access ON public.users;
CREATE POLICY users_self_access ON public.users FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS business_users_self_read ON public.business_users;
CREATE POLICY business_users_self_read ON public.business_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS businesses_member_access ON public.businesses;
CREATE POLICY businesses_member_access ON public.businesses FOR SELECT TO authenticated
  USING (public.is_bizpilot_business_member(id));
DROP POLICY IF EXISTS businesses_member_update ON public.businesses;
CREATE POLICY businesses_member_update ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_bizpilot_business_member(id)) WITH CHECK (public.is_bizpilot_business_member(id));
DROP POLICY IF EXISTS appointments_business_access ON public.appointments;
CREATE POLICY appointments_business_access ON public.appointments FOR ALL TO authenticated
  USING (public.is_bizpilot_business_member(business_id)) WITH CHECK (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS campaigns_business_access ON public.campaigns;
CREATE POLICY campaigns_business_access ON public.campaigns FOR ALL TO authenticated
  USING (public.is_bizpilot_business_member(business_id)) WITH CHECK (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS customers_business_access ON public.customers;
CREATE POLICY customers_business_access ON public.customers FOR ALL TO authenticated
  USING (public.is_bizpilot_business_member(business_id)) WITH CHECK (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS expenses_business_access ON public.expenses;
CREATE POLICY expenses_business_access ON public.expenses FOR ALL TO authenticated
  USING (public.is_bizpilot_business_member(business_id)) WITH CHECK (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS services_business_access ON public.services;
CREATE POLICY services_business_access ON public.services FOR ALL TO authenticated
  USING (public.is_bizpilot_business_member(business_id)) WITH CHECK (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS invoices_business_read ON public.invoices;
CREATE POLICY invoices_business_read ON public.invoices FOR SELECT TO authenticated
  USING (public.is_bizpilot_business_member(business_id));
DROP POLICY IF EXISTS payments_business_read ON public.payments;
CREATE POLICY payments_business_read ON public.payments FOR SELECT TO authenticated
  USING (public.is_bizpilot_business_member(business_id));

REVOKE ALL ON public.users, public.businesses, public.business_users, public.customers,
  public.services, public.appointments, public.invoices, public.payments,
  public.expenses, public.campaigns FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (full_name, updated_at) ON public.users TO authenticated;
GRANT SELECT ON public.businesses TO authenticated;
GRANT UPDATE (name, currency_code, updated_at) ON public.businesses TO authenticated;
GRANT SELECT ON public.business_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.services,
  public.appointments, public.expenses, public.campaigns TO authenticated;
GRANT SELECT ON public.invoices, public.payments TO authenticated;

CREATE OR REPLACE FUNCTION public.record_bizpilot_payment(
  target_invoice_id uuid,
  payment_amount numeric,
  payment_method text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_business_id uuid;
  target_customer_id uuid;
  invoice_total numeric(12,2);
  invoice_paid numeric(12,2);
  new_paid numeric(12,2);
  payment_id uuid;
  new_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in to record a payment.'; END IF;
  SELECT business_id INTO active_business_id FROM public.business_users WHERE user_id = auth.uid() LIMIT 1;
  IF active_business_id IS NULL THEN RAISE EXCEPTION 'No business workspace is linked to this account.'; END IF;
  IF payment_method NOT IN ('cash','upi','card','bank_transfer','other') THEN RAISE EXCEPTION 'Choose a valid payment method.'; END IF;
  IF payment_amount IS NULL OR payment_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero.'; END IF;
  SELECT customer_id, total, paid_amount INTO target_customer_id, invoice_total, invoice_paid
    FROM public.invoices WHERE id = target_invoice_id AND business_id = active_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found in this business.'; END IF;
  IF payment_amount > invoice_total - invoice_paid THEN RAISE EXCEPTION 'Payment exceeds the remaining invoice balance.'; END IF;
  new_paid := invoice_paid + round(payment_amount, 2);
  new_status := CASE WHEN new_paid >= invoice_total THEN 'paid' ELSE 'partially_paid' END;
  INSERT INTO public.payments (business_id, invoice_id, customer_id, amount, method)
  VALUES (active_business_id, target_invoice_id, target_customer_id, round(payment_amount, 2), payment_method)
  RETURNING id INTO payment_id;
  UPDATE public.invoices SET paid_amount = new_paid, status = new_status, updated_at = now()
    WHERE id = target_invoice_id AND business_id = active_business_id;
  RETURN jsonb_build_object('id', payment_id, 'invoiceId', target_invoice_id, 'amount', round(payment_amount, 2), 'status', new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.record_bizpilot_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bizpilot_payment(uuid, numeric, text) TO authenticated;
