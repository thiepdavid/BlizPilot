-- Store itemized invoice details without changing existing invoice totals.
-- Safe to run more than once; existing invoices receive an empty item list.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;
