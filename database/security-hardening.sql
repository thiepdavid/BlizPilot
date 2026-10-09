-- These are trigger/event-trigger functions. They are invoked by PostgreSQL,
-- not through the Supabase RPC API, so application roles do not need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_bizpilot_signup() FROM PUBLIC, anon, authenticated;

-- Anonymous visitors use the API for booking requests. Keeping this write RPC
-- service-role-only ensures they cannot bypass API validation and rate limits.
REVOKE EXECUTE ON FUNCTION public.request_public_booking(text, text, text, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_public_booking(text, text, text, text, uuid, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_public_booking_page(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_page(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_public_booking_busy_times(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_busy_times(text, date) TO service_role;

-- Pin privileged booking functions to PostgreSQL's built-ins only. Every
-- application table and auth function in their bodies is schema-qualified.
ALTER FUNCTION public.create_public_booking_page(uuid, text) SET search_path = '';
ALTER FUNCTION public.create_public_booking_page(uuid, text, text) SET search_path = '';
ALTER FUNCTION public.get_business_booking_closures(uuid) SET search_path = '';
ALTER FUNCTION public.get_business_booking_hours(uuid) SET search_path = '';
ALTER FUNCTION public.get_public_booking_busy_times(text, date) SET search_path = '';
ALTER FUNCTION public.get_public_booking_page(text) SET search_path = '';
ALTER FUNCTION public.request_public_booking(text, text, text, text, uuid, timestamptz) SET search_path = '';
ALTER FUNCTION public.save_business_booking_closures(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.save_business_booking_hours(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.save_business_booking_timezone(uuid, text) SET search_path = '';
