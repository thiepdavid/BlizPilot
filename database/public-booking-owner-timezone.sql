-- Owner-controlled booking page creation and timezone settings.
-- Run after public-booking-hours.sql.
CREATE OR REPLACE FUNCTION public.create_public_booking_page(
  target_business_id uuid,
  target_slug text,
  target_timezone text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE saved_slug text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = auth.uid() AND business_id = target_business_id
  ) THEN RAISE EXCEPTION 'You are not allowed to create a booking page for this business'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = target_timezone) THEN
    RAISE EXCEPTION 'Choose a valid time zone';
  END IF;
  INSERT INTO public.booking_pages(business_id, slug, timezone)
  VALUES (target_business_id, target_slug, target_timezone)
  ON CONFLICT (business_id) DO UPDATE SET timezone = EXCLUDED.timezone
  RETURNING slug INTO saved_slug;
  RETURN saved_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_business_booking_timezone(
  target_business_id uuid,
  target_timezone text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE saved_timezone text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = auth.uid() AND business_id = target_business_id
  ) THEN RAISE EXCEPTION 'You are not allowed to change this business time zone'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = target_timezone) THEN
    RAISE EXCEPTION 'Choose a valid time zone';
  END IF;
  UPDATE public.booking_pages SET timezone = target_timezone WHERE business_id = target_business_id
  RETURNING timezone INTO saved_timezone;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your booking page first'; END IF;
  RETURN saved_timezone;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_booking_page(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking_page(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.save_business_booking_timezone(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_business_booking_timezone(uuid, text) TO authenticated;
