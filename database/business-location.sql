-- Add optional international business address and tax registration fields.
-- Safe to run more than once; existing values and columns are preserved.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS tax_id text;
