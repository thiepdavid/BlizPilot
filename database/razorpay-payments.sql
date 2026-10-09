-- Apply this once in Supabase SQL Editor to enable verified Razorpay payments.
-- Duplicate Razorpay webhook deliveries are ignored by the unique payment ID.

create table if not exists public.razorpay_processed_payments (
  razorpay_payment_id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices(id, business_id) on delete cascade
);

alter table public.razorpay_processed_payments enable row level security;
revoke all on public.razorpay_processed_payments from anon, authenticated;

create or replace function public.record_bizpilot_razorpay_payment(
  target_invoice_id uuid,
  target_business_id uuid,
  payment_amount numeric,
  payment_method text,
  target_razorpay_payment_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_total numeric(12, 2);
  invoice_paid numeric(12, 2);
  invoice_customer_id uuid;
  inserted_rows integer;
begin
  if target_razorpay_payment_id is null or length(target_razorpay_payment_id) < 5 then
    raise exception 'Invalid Razorpay payment ID';
  end if;
  if payment_method not in ('upi', 'card', 'other') then
    raise exception 'Invalid Razorpay payment method';
  end if;

  select customer_id, total, coalesce(paid_amount, 0)
    into invoice_customer_id, invoice_total, invoice_paid
    from public.invoices
    where id = target_invoice_id and business_id = target_business_id
    for update;
  if not found then raise exception 'Invoice not found for this business'; end if;
  if payment_amount <= 0 or payment_amount > invoice_total - invoice_paid then
    raise exception 'Payment amount exceeds remaining invoice balance';
  end if;

  insert into public.razorpay_processed_payments(razorpay_payment_id, business_id, invoice_id, amount)
  values (target_razorpay_payment_id, target_business_id, target_invoice_id, payment_amount)
  on conflict (razorpay_payment_id) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return; end if;

  insert into public.payments(business_id, invoice_id, customer_id, amount, method, paid_at)
  values (target_business_id, target_invoice_id, invoice_customer_id, payment_amount, payment_method, now());

  update public.invoices
    set paid_amount = invoice_paid + payment_amount,
        status = case when invoice_paid + payment_amount >= invoice_total then 'paid' else 'partially_paid' end
    where id = target_invoice_id and business_id = target_business_id;
end;
$$;

revoke all on function public.record_bizpilot_razorpay_payment(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.record_bizpilot_razorpay_payment(uuid, uuid, numeric, text, text) to service_role;
