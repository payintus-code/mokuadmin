do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'cancelled');
  end if;
end
$$;

create table if not exists public.shop_settings (
  id integer primary key default 1,
  shop_name text not null,
  shop_address text,
  shop_phone text,
  promptpay_target text,
  receipt_prefix text not null default 'RC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_settings_single_row_chk check (id = 1)
);

insert into public.shop_settings (id, shop_name, shop_address, shop_phone, promptpay_target, receipt_prefix)
values (1, 'Moku Pet', 'กังสดาล ซอยวุ่นวาย', '0826922622', '0826922622', 'RC')
on conflict (id) do update
set
  shop_name = excluded.shop_name,
  shop_address = coalesce(public.shop_settings.shop_address, excluded.shop_address),
  shop_phone = coalesce(public.shop_settings.shop_phone, excluded.shop_phone),
  promptpay_target = coalesce(public.shop_settings.promptpay_target, excluded.promptpay_target),
  receipt_prefix = coalesce(public.shop_settings.receipt_prefix, excluded.receipt_prefix);

alter table public.cash_transactions
  drop constraint if exists cash_transactions_payment_method_chk;

alter table public.cash_transactions
  add constraint cash_transactions_payment_method_chk
  check (payment_method in ('cash', 'promptpay_qr', 'transfer', 'card', 'other'));

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  amount numeric(10,2) not null,
  method text not null default 'cash',
  status public.payment_status not null default 'pending',
  reference_no text,
  receipt_no text unique,
  receipt_issued_at timestamptz,
  paid_at timestamptz,
  confirmed_by uuid references public.app_users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_payments_amount_chk check (amount >= 0),
  constraint booking_payments_method_chk check (method in ('cash', 'promptpay_qr', 'transfer', 'card', 'other'))
);

create index if not exists idx_booking_payments_booking_id on public.booking_payments (booking_id);
create index if not exists idx_booking_payments_status on public.booking_payments (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shop_settings_updated_at on public.shop_settings;
create trigger trg_shop_settings_updated_at
before update on public.shop_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_booking_payments_updated_at on public.booking_payments;
create trigger trg_booking_payments_updated_at
before update on public.booking_payments
for each row execute function public.set_updated_at();

insert into public.booking_payments (
  booking_id,
  amount,
  method,
  status,
  paid_at,
  note
)
select
  ct.booking_id,
  ct.amount,
  case
    when ct.payment_method = 'cash' then 'cash'
    when ct.payment_method = 'transfer' then 'transfer'
    when ct.payment_method = 'card' then 'card'
    when ct.payment_method = 'other' then 'other'
    else 'cash'
  end as method,
  'paid'::public.payment_status,
  coalesce(ct.created_at, now()),
  'Backfilled from existing income transaction'
from public.cash_transactions ct
where ct.transaction_type = 'income'
  and ct.booking_id is not null
on conflict (booking_id) do update
set
  amount = excluded.amount,
  method = excluded.method,
  status = excluded.status,
  paid_at = coalesce(public.booking_payments.paid_at, excluded.paid_at),
  note = coalesce(public.booking_payments.note, excluded.note);

create or replace function public.get_daily_schedule(p_day date)
returns table (
  booking_id uuid,
  booking_no text,
  booking_type public.booking_type,
  status public.booking_status,
  payment_status public.payment_status,
  start_at timestamptz,
  end_at timestamptz,
  customer_name text,
  pet_name text,
  room_name text,
  services_summary text,
  total_amount numeric
)
language sql
stable
as $$
  select
    b.id as booking_id,
    b.booking_no,
    b.booking_type,
    b.status,
    coalesce(bp.status, 'pending'::public.payment_status) as payment_status,
    b.start_at,
    b.end_at,
    c.full_name as customer_name,
    concat_ws(', ', p1.name, p2.name) as pet_name,
    r.name as room_name,
    coalesce(string_agg(s.name, ', ' order by s.name) filter (where s.name is not null), '') as services_summary,
    b.total_amount
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.pets p1 on p1.id = b.pet_id
  left join public.pets p2 on p2.id = b.secondary_pet_id
  left join public.rooms r on r.id = b.room_id
  left join public.booking_payments bp on bp.booking_id = b.id
  left join public.booking_items bi on bi.booking_id = b.id
  left join public.services s on s.id = bi.service_id
  where tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_day::timestamptz, (p_day + 1)::timestamptz, '[)')
  group by b.id, c.full_name, p1.name, p2.name, r.name, bp.status
  order by b.start_at, b.created_at;
$$;
