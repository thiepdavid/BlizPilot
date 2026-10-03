-- Account deletion support for BizPilot.
-- Run in the Supabase SQL Editor before enabling the API endpoint.
-- The backend calls this only with the server-side service role key.

CREATE OR REPLACE FUNCTION public.delete_bizpilot_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.businesses AS business
    WHERE business.owner_id = p_user_id
      AND EXISTS (
        SELECT 1 FROM public.business_users AS other_member
        WHERE other_member.business_id = business.id AND other_member.user_id <> p_user_id
      )
  ) THEN
    RAISE EXCEPTION 'Transfer ownership of shared businesses before deleting this account';
  END IF;

  -- Delete a business and its cascading records only when this user is its
  -- only member. Shared workspaces remain available to the other members.
  DELETE FROM public.businesses AS business
  WHERE (business.owner_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.business_users AS member
    WHERE member.business_id = business.id AND member.user_id = p_user_id
  ))
  AND NOT EXISTS (
    SELECT 1 FROM public.business_users AS other_member
    WHERE other_member.business_id = business.id AND other_member.user_id <> p_user_id
  );

  DELETE FROM public.business_users WHERE user_id = p_user_id;
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_bizpilot_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bizpilot_user_data(uuid) TO service_role;
