-- Add business-private notes and service preferences to customer records.
alter table public.customers
  add column if not exists notes text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_notes_length_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_notes_length_check
      check (char_length(notes) <= 2000);
  end if;
end $$;
