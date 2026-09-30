-- Run once in Supabase SQL Editor to enable shareable appointment request pages.
-- Public visitors can read only the business name and active service list, then
-- submit a pending appointment request through a constrained database function.

create table if not exists public.booking_pages (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  slug text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.booking_pages enable row level security;
revoke all on public.booking_pages from anon, authenticated;

create or replace function public.create_public_booking_page(target_business_id uuid, target_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare saved_slug text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_users
    where user_id = auth.uid() and business_id = target_business_id
  ) then
    raise exception 'You are not allowed to create a booking page for this business';
  end if;

  insert into public.booking_pages(business_id, slug)
  values (target_business_id, target_slug)
  on conflict (business_id) do update set business_id = excluded.business_id
  returning slug into saved_slug;
  return saved_slug;
end;
$$;

create or replace function public.get_public_booking_page(target_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'businessName', b.name,
    'services', coalesce(
      jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', coalesce(s.description, ''),
        'durationMinutes', s.duration_minutes,
        'price', s.price
      ) order by s.name) filter (where s.id is not null),
      '[]'::jsonb
    )
  )
  from public.booking_pages bp
  join public.businesses b on b.id = bp.business_id
  left join public.services s on s.business_id = bp.business_id and s.is_active = true
  where bp.slug = target_slug and bp.enabled = true
  group by b.id, b.name;
$$;

create or replace function public.request_public_booking(
  target_slug text,
  customer_name text,
  customer_phone text,
  customer_email text,
  target_service_id uuid,
  requested_start timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
  target_service_name text;
  target_duration integer;
  customer_record_id uuid;
  appointment_record_id uuid;
  requested_end timestamptz;
begin
  if customer_name is null or length(trim(customer_name)) < 2 or length(trim(customer_name)) > 100 then
    raise exception 'Enter your name (2 to 100 characters)';
  end if;
  if (nullif(trim(customer_phone), '') is null and nullif(trim(customer_email), '') is null)
    or length(coalesce(customer_phone, '')) > 40 or length(coalesce(customer_email, '')) > 254 then
    raise exception 'Enter a valid phone number or email address';
  end if;
  if requested_start is null or requested_start <= now() or requested_start > now() + interval '90 days' then
    raise exception 'Choose a date within the next 90 days';
  end if;

  select business_id into target_business_id
  from public.booking_pages where slug = target_slug and enabled = true;
  if target_business_id is null then raise exception 'This booking page is not available'; end if;

  perform pg_advisory_xact_lock(hashtext(target_business_id::text)::bigint);
  select name, duration_minutes into target_service_name, target_duration
  from public.services
  where id = target_service_id and business_id = target_business_id and is_active = true;
  if target_service_name is null then raise exception 'Choose an available service'; end if;
  requested_end := requested_start + make_interval(mins => target_duration);

  if exists (
    select 1 from public.appointments a
    where a.business_id = target_business_id
      and a.status not in ('cancelled', 'no_show')
      and a.starts_at < requested_end
      and a.ends_at > requested_start
  ) then
    raise exception 'That time is no longer available. Please choose another time';
  end if;

  select id into customer_record_id
  from public.customers
  where business_id = target_business_id
    and ((nullif(trim(customer_phone), '') is not null and phone = trim(customer_phone))
      or (nullif(trim(customer_email), '') is not null and lower(email) = lower(trim(customer_email))))
  limit 1;
  if customer_record_id is null then
    insert into public.customers(business_id, full_name, phone, email)
    values (target_business_id, trim(customer_name), nullif(trim(customer_phone), ''), nullif(lower(trim(customer_email)), ''))
    returning id into customer_record_id;
  end if;

  insert into public.appointments(business_id, customer_id, service_name, starts_at, ends_at, duration_minutes, status)
  values (target_business_id, customer_record_id, target_service_name, requested_start, requested_end, target_duration, 'pending')
  returning id into appointment_record_id;

  return jsonb_build_object(
    'appointmentId', appointment_record_id,
    'businessName', (select name from public.businesses where id = target_business_id),
    'service', target_service_name,
    'startsAt', requested_start,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.create_public_booking_page(uuid, text) from public, anon;
grant execute on function public.create_public_booking_page(uuid, text) to authenticated;
revoke all on function public.get_public_booking_page(text) from public;
grant execute on function public.get_public_booking_page(text) to anon, authenticated;
revoke all on function public.request_public_booking(text, text, text, text, uuid, timestamptz) from public;
grant execute on function public.request_public_booking(text, text, text, text, uuid, timestamptz) to anon, authenticated;
