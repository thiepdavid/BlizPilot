-- Run after public-booking-closures.sql. Returns only occupied time ranges,
-- never customer names or contact details, for a public booking date.

create or replace function public.get_public_booking_busy_times(target_slug text, target_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare target_business_id uuid; target_timezone text; result jsonb;
begin
  select business_id, timezone into target_business_id, target_timezone
    from public.booking_pages where slug = target_slug and enabled = true;
  if target_business_id is null then raise exception 'This booking page is not available'; end if;
  if target_date < (now() at time zone target_timezone)::date
    or target_date > (now() at time zone target_timezone)::date + 90 then
    raise exception 'Choose a date within the next 90 days';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('startsAt', a.starts_at, 'endsAt', a.ends_at) order by a.starts_at), '[]'::jsonb)
    into result
    from public.appointments a
    where a.business_id = target_business_id
      and a.status not in ('cancelled', 'no_show')
      and a.starts_at < ((target_date + 1)::timestamp at time zone target_timezone)
      and a.ends_at > (target_date::timestamp at time zone target_timezone);
  return result;
end;
$$;

revoke all on function public.get_public_booking_busy_times(text, date) from public;
grant execute on function public.get_public_booking_busy_times(text, date) to anon, authenticated;
