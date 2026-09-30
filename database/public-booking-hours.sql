-- Run this after public-booking.sql. Existing booking pages receive a default
-- Monday-Saturday 9:00-18:00 schedule in India Standard Time; Sunday is closed.

alter table public.booking_pages
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists business_hours jsonb not null default '{
    "0": {"closed": true},
    "1": {"open": "09:00", "close": "18:00"},
    "2": {"open": "09:00", "close": "18:00"},
    "3": {"open": "09:00", "close": "18:00"},
    "4": {"open": "09:00", "close": "18:00"},
    "5": {"open": "09:00", "close": "18:00"},
    "6": {"open": "09:00", "close": "18:00"}
  }'::jsonb;

create or replace function public.get_business_booking_hours(target_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.business_users where user_id = auth.uid() and business_id = target_business_id) then
    raise exception 'You are not allowed to view these business hours';
  end if;
  select jsonb_build_object('timezone', timezone, 'hours', business_hours) into result from public.booking_pages where business_id = target_business_id;
  if result is null then raise exception 'Create your booking page first'; end if;
  return result;
end;
$$;

create or replace function public.save_business_booking_hours(target_business_id uuid, target_hours jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare day_number integer; day_hours jsonb; open_time text; close_time text; saved jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.business_users where user_id = auth.uid() and business_id = target_business_id) then
    raise exception 'You are not allowed to change these business hours';
  end if;
  if jsonb_typeof(target_hours) <> 'object' then raise exception 'Enter hours for all seven days'; end if;
  for day_number in 0..6 loop
    day_hours := target_hours -> day_number::text;
    if day_hours is null then raise exception 'Enter hours for all seven days'; end if;
    if day_hours ? 'closed' and jsonb_typeof(day_hours -> 'closed') <> 'boolean' then raise exception 'Each day must be marked open or closed'; end if;
    if coalesce((day_hours ->> 'closed')::boolean, false) then continue; end if;
    open_time := day_hours ->> 'open'; close_time := day_hours ->> 'close';
    if open_time is null or close_time is null
      or open_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or close_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or close_time <= open_time then
      raise exception 'Open and close times must be valid, and closing must be later';
    end if;
  end loop;
  update public.booking_pages set business_hours = target_hours where business_id = target_business_id;
  if not found then raise exception 'Create your booking page first'; end if;
  select jsonb_build_object('timezone', timezone, 'hours', business_hours) into saved from public.booking_pages where business_id = target_business_id;
  return saved;
end;
$$;

create or replace function public.get_public_booking_page(target_slug text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'businessName', b.name, 'timezone', bp.timezone, 'hours', bp.business_hours,
    'services', coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'description', coalesce(s.description, ''),
      'durationMinutes', s.duration_minutes, 'price', s.price
    ) order by s.name) filter (where s.id is not null), '[]'::jsonb)
  )
  from public.booking_pages bp
  join public.businesses b on b.id = bp.business_id
  left join public.services s on s.business_id = bp.business_id and s.is_active = true
  where bp.slug = target_slug and bp.enabled = true
  group by b.id, b.name, bp.timezone, bp.business_hours;
$$;

create or replace function public.request_public_booking(
  target_slug text, customer_name text, customer_phone text, customer_email text,
  target_service_id uuid, requested_start timestamptz
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target_business_id uuid; target_timezone text; target_hours jsonb; day_hours jsonb;
  local_start timestamp; local_end timestamp; target_service_name text; target_duration integer;
  day_number integer; customer_record_id uuid; appointment_record_id uuid; requested_end timestamptz;
begin
  if customer_name is null or length(trim(customer_name)) < 2 or length(trim(customer_name)) > 100 then raise exception 'Enter your name (2 to 100 characters)'; end if;
  if (nullif(trim(customer_phone), '') is null and nullif(trim(customer_email), '') is null)
    or length(coalesce(customer_phone, '')) > 40 or length(coalesce(customer_email, '')) > 254 then raise exception 'Enter a valid phone number or email address'; end if;
  if requested_start is null or requested_start <= now() or requested_start > now() + interval '90 days' then raise exception 'Choose a date within the next 90 days'; end if;
  select business_id, timezone, business_hours into target_business_id, target_timezone, target_hours from public.booking_pages where slug = target_slug and enabled = true;
  if target_business_id is null then raise exception 'This booking page is not available'; end if;
  perform pg_advisory_xact_lock(hashtext(target_business_id::text)::bigint);
  select name, duration_minutes into target_service_name, target_duration from public.services where id = target_service_id and business_id = target_business_id and is_active = true;
  if target_service_name is null then raise exception 'Choose an available service'; end if;
  requested_end := requested_start + make_interval(mins => target_duration);
  local_start := requested_start at time zone target_timezone;
  local_end := requested_end at time zone target_timezone;
  day_number := extract(dow from local_start)::integer;
  day_hours := target_hours -> day_number::text;
  if day_hours is null or local_end::date <> local_start::date or coalesce((day_hours ->> 'closed')::boolean, false)
    or local_start::time < (day_hours ->> 'open')::time or local_end::time > (day_hours ->> 'close')::time then
    raise exception 'Choose a time during this business’s opening hours';
  end if;
  if exists (select 1 from public.appointments a where a.business_id = target_business_id
    and a.status not in ('cancelled', 'no_show') and a.starts_at < requested_end and a.ends_at > requested_start) then
    raise exception 'That time is no longer available. Please choose another time';
  end if;
  select id into customer_record_id from public.customers where business_id = target_business_id
    and ((nullif(trim(customer_phone), '') is not null and phone = trim(customer_phone))
      or (nullif(trim(customer_email), '') is not null and lower(email) = lower(trim(customer_email)))) limit 1;
  if customer_record_id is null then
    insert into public.customers(business_id, full_name, phone, email)
    values (target_business_id, trim(customer_name), nullif(trim(customer_phone), ''), nullif(lower(trim(customer_email)), '')) returning id into customer_record_id;
  end if;
  insert into public.appointments(business_id, customer_id, service_name, starts_at, ends_at, duration_minutes, status)
  values (target_business_id, customer_record_id, target_service_name, requested_start, requested_end, target_duration, 'pending') returning id into appointment_record_id;
  return jsonb_build_object('appointmentId', appointment_record_id,
    'businessName', (select name from public.businesses where id = target_business_id),
    'service', target_service_name, 'startsAt', requested_start, 'status', 'pending');
end;
$$;

revoke all on function public.get_business_booking_hours(uuid) from public, anon;
grant execute on function public.get_business_booking_hours(uuid) to authenticated;
revoke all on function public.save_business_booking_hours(uuid, jsonb) from public, anon;
grant execute on function public.save_business_booking_hours(uuid, jsonb) to authenticated;
revoke all on function public.get_public_booking_page(text) from public;
grant execute on function public.get_public_booking_page(text) to anon, authenticated;
revoke all on function public.request_public_booking(text, text, text, text, uuid, timestamptz) from public;
grant execute on function public.request_public_booking(text, text, text, text, uuid, timestamptz) to anon, authenticated;
