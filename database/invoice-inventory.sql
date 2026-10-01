-- Atomically snapshot product price/cost, reduce stock, and create an invoice.
-- Run after business-type-inventory.sql and invoice-line-items.sql.
CREATE OR REPLACE FUNCTION public.create_bizpilot_invoice_with_inventory(
  target_customer_id uuid,
  target_description text,
  target_items jsonb,
  target_tax_rate numeric,
  target_due_date date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  active_business_id uuid;
  line jsonb;
  product_row public.inventory_items%ROWTYPE;
  item_id uuid;
  item_quantity numeric;
  item_price numeric;
  item_cost numeric;
  item_description text;
  item_total numeric;
  calculated_subtotal numeric := 0;
  calculated_tax numeric;
  calculated_total numeric;
  saved_items jsonb := '[]'::jsonb;
  created_invoice_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in to create an invoice.'; END IF;
  SELECT business_id INTO active_business_id FROM public.business_users WHERE user_id = auth.uid() LIMIT 1;
  IF active_business_id IS NULL THEN RAISE EXCEPTION 'No business workspace is linked to this account.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = target_customer_id AND business_id = active_business_id) THEN
    RAISE EXCEPTION 'Choose a customer from your customer list.';
  END IF;
  IF target_tax_rate < 0 OR target_tax_rate > 100 THEN RAISE EXCEPTION 'Choose a valid tax rate.'; END IF;

  IF jsonb_typeof(target_items) <> 'array' OR jsonb_array_length(target_items) > 50 THEN
    RAISE EXCEPTION 'Add between 1 and 50 invoice items.';
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(target_items)
  LOOP
    item_quantity := (line->>'quantity')::numeric;
    item_id := NULLIF(line->>'inventoryItemId', '')::uuid;
    IF item_quantity <= 0 OR item_quantity > 10000 THEN RAISE EXCEPTION 'Each item needs a positive quantity.'; END IF;
    IF item_id IS NOT NULL THEN
      IF item_quantity <> trunc(item_quantity) THEN RAISE EXCEPTION 'Clothing product quantities must be whole numbers.'; END IF;
      SELECT * INTO product_row FROM public.inventory_items WHERE id = item_id AND business_id = active_business_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'A selected product is unavailable. Refresh Inventory and try again.'; END IF;
      IF product_row.quantity < item_quantity THEN
        RAISE EXCEPTION 'Not enough stock for % (%, left).', product_row.name, product_row.quantity;
      END IF;
      UPDATE public.inventory_items SET quantity = quantity - item_quantity, updated_at = now() WHERE id = item_id AND business_id = active_business_id;
      item_description := concat_ws(' · ', product_row.name, NULLIF(product_row.size, ''), NULLIF(product_row.color, ''));
      item_price := product_row.selling_price;
      item_cost := product_row.cost_price;
    ELSE
      item_description := btrim(line->>'description');
      item_price := (line->>'unitPrice')::numeric;
      item_cost := 0;
      IF item_description IS NULL OR item_description = '' OR item_price < 0 THEN RAISE EXCEPTION 'Each item needs a description and a valid price.'; END IF;
    END IF;
    item_total := round(item_quantity * item_price, 2);
    calculated_subtotal := calculated_subtotal + item_total;
    saved_items := saved_items || jsonb_build_array(jsonb_build_object(
      'description', item_description,
      'quantity', item_quantity,
      'unitPrice', item_price,
      'total', item_total,
      'inventoryItemId', item_id,
      'costPrice', item_cost
    ));
  END LOOP;

  calculated_subtotal := round(calculated_subtotal, 2);
  IF calculated_subtotal <= 0 THEN RAISE EXCEPTION 'Invoice total must be greater than zero.'; END IF;
  calculated_tax := round(calculated_subtotal * target_tax_rate) / 100;
  calculated_total := calculated_subtotal + calculated_tax;
  INSERT INTO public.invoices (business_id, customer_id, invoice_number, description, line_items, subtotal, tax, total, paid_amount, due_date, status)
  VALUES (active_business_id, target_customer_id, 'BP-' || extract(year FROM now())::text || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), target_description, saved_items, calculated_subtotal, calculated_tax, calculated_total, 0, target_due_date, 'sent')
  RETURNING id INTO created_invoice_id;
  RETURN created_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bizpilot_invoice_with_inventory(uuid, text, jsonb, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bizpilot_invoice_with_inventory(uuid, text, jsonb, numeric, date) TO authenticated;
