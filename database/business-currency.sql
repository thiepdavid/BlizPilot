-- Set one accounting currency for each business. Existing amounts remain unchanged.
alter table public.businesses
  add column if not exists currency_code text not null default 'INR';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_currency_code_check'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_currency_code_check
      check (currency_code ~ '^[A-Z]{3}$');
  end if;
end $$;

create or replace function public.get_public_booking_page(target_slug text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'businessName', b.name, 'currencyCode', b.currency_code, 'timezone', bp.timezone,
    'hours', bp.business_hours, 'closedDates', to_jsonb(bp.closed_dates),
    'services', coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'description', coalesce(s.description, ''),
      'durationMinutes', s.duration_minutes, 'price', s.price
    ) order by s.name) filter (where s.id is not null), '[]'::jsonb)
  )
  from public.booking_pages bp
  join public.businesses b on b.id = bp.business_id
  left join public.services s on s.business_id = bp.business_id and s.is_active = true
  where bp.slug = target_slug and bp.enabled = true
  group by b.id, b.name, b.currency_code, bp.timezone, bp.business_hours, bp.closed_dates;
$$;

create or replace function public.save_business_booking_timezone(target_business_id uuid, target_timezone text)
returns text language plpgsql security definer set search_path = public
as $$
declare saved_timezone text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_users where user_id = auth.uid() and business_id = target_business_id
  ) then raise exception 'You are not allowed to change this business time zone'; end if;
  if not exists (select 1 from pg_timezone_names where name = target_timezone) then
    raise exception 'Choose a valid time zone';
  end if;
  update public.booking_pages set timezone = target_timezone where business_id = target_business_id
    returning timezone into saved_timezone;
  if not found then raise exception 'Create your booking page first'; end if;
  return saved_timezone;
end;
$$;

revoke all on function public.save_business_booking_timezone(uuid, text) from public, anon;
grant execute on function public.save_business_booking_timezone(uuid, text) to authenticated;
