-- Business type and variant-based inventory for BizPilot.
-- Run once in Supabase SQL Editor. Safe to re-run.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'other';

DO $$ BEGIN
  ALTER TABLE public.businesses ADD CONSTRAINT businesses_business_type_check
    CHECK (business_type IN ('boutique', 'restaurant', 'salon', 'grocery', 'electronics', 'pharmacy', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  category text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(12,2) NOT NULL CHECK (selling_price >= 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_at integer NOT NULL DEFAULT 2 CHECK (low_stock_at >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_items_business_access ON public.inventory_items;
CREATE POLICY inventory_items_business_access ON public.inventory_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.user_id = auth.uid() AND bu.business_id = inventory_items.business_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.user_id = auth.uid() AND bu.business_id = inventory_items.business_id));

CREATE INDEX IF NOT EXISTS inventory_items_business_name_idx ON public.inventory_items (business_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_business_sku_idx ON public.inventory_items (business_id, lower(sku)) WHERE sku <> '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
