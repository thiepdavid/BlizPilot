-- Store ISO 4217 currency codes. This labels business amounts; it does not convert them.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'INR';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'businesses_currency_code_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_currency_code_check
      CHECK (currency_code ~ '^[A-Z]{3}$');
  END IF;
END;
$$;

GRANT UPDATE (currency_code, updated_at) ON public.businesses TO authenticated;
