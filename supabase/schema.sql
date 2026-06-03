create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'staff');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_type') then
    create type public.booking_type as enum ('grooming', 'hotel');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum ('pending', 'confirmed', 'in_progress', 'done', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'pet_gender') then
    create type public.pet_gender as enum ('male', 'female', 'unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('income', 'expense');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'cancelled');
  end if;
end
$$;

create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  facebook_name text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_format_chk check (phone ~ '^[0-9+ -]{8,20}$')
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  gender public.pet_gender not null default 'unknown',
  birth_date date,
  weight_kg numeric(5,2),
  temperament_note text,
  allergy_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pets_weight_chk check (weight_kg is null or weight_kg > 0)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'grooming',
  duration_minutes integer not null,
  price numeric(10,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_duration_chk check (duration_minutes > 0),
  constraint services_price_chk check (price >= 0)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  room_type text not null default 'standard',
  max_pets integer not null default 1,
  nightly_rate numeric(10,2) not null,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint rooms_max_pets_chk check (max_pets > 0),
  constraint rooms_nightly_rate_chk check (nightly_rate >= 0)
);

create table if not exists public.shop_settings (
  id integer primary key default 1,
  shop_name text not null,
  shop_address text,
  shop_phone text,
  promptpay_target text,
  bank_code text,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  receipt_prefix text not null default 'RC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_settings_single_row_chk check (id = 1)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text not null unique,
  booking_type public.booking_type not null,
  status public.booking_status not null default 'pending',
  customer_id uuid not null references public.customers (id) on delete restrict,
  pet_id uuid not null references public.pets (id) on delete restrict,
  secondary_pet_id uuid references public.pets (id) on delete restrict,
  room_id uuid references public.rooms (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  total_amount numeric(10,2) not null default 0,
  note text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_chk check (end_at > start_at),
  constraint bookings_total_amount_chk check (total_amount >= 0),
  constraint bookings_distinct_pets_chk check (secondary_pet_id is null or secondary_pet_id <> pet_id),
  constraint bookings_room_type_chk check (
    (booking_type = 'hotel' and room_id is not null) or
    (booking_type = 'grooming' and room_id is null)
  ),
  constraint bookings_check_in_out_chk check (
    check_out_at is null or check_in_at is null or check_out_at >= check_in_at
  )
);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  duration_minutes integer not null,
  note text,
  created_at timestamptz not null default now(),
  constraint booking_items_qty_chk check (qty > 0),
  constraint booking_items_unit_price_chk check (unit_price >= 0),
  constraint booking_items_duration_chk check (duration_minutes > 0)
);

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type public.transaction_type not null,
  category text not null default 'service_income',
  booking_id uuid references public.bookings (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  amount numeric(10,2) not null,
  payment_method text not null default 'cash',
  transaction_date date not null default current_date,
  note text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cash_transactions_amount_chk check (amount > 0),
  constraint cash_transactions_payment_method_chk check (payment_method in ('cash', 'promptpay_qr', 'transfer', 'card', 'other')),
  constraint cash_transactions_category_chk check (
    category in (
      'service_income',
      'hotel_income',
      'product_income',
      'other_income',
      'supplies_expense',
      'wages_expense',
      'shampoo_expense',
      'food_expense',
      'other_expense'
    )
  )
);

alter table public.cash_transactions
  add column if not exists category text not null default 'service_income';

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

create index if not exists idx_pets_customer_id on public.pets (customer_id);
create unique index if not exists idx_pets_customer_active_name_unique on public.pets (customer_id, name) where is_active = true;
create index if not exists idx_bookings_customer_id on public.bookings (customer_id);
create index if not exists idx_bookings_pet_id on public.bookings (pet_id);
create index if not exists idx_bookings_secondary_pet_id on public.bookings (secondary_pet_id);
create index if not exists idx_bookings_room_id on public.bookings (room_id);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_start_at on public.bookings (start_at);
create index if not exists idx_bookings_type_start_at on public.bookings (booking_type, start_at);
create index if not exists idx_booking_items_booking_id on public.booking_items (booking_id);
create index if not exists idx_cash_transactions_date on public.cash_transactions (transaction_date desc);
create index if not exists idx_cash_transactions_type_date on public.cash_transactions (transaction_type, transaction_date desc);
create index if not exists idx_cash_transactions_booking_id on public.cash_transactions (booking_id);
create index if not exists idx_booking_payments_booking_id on public.booking_payments (booking_id);
create index if not exists idx_booking_payments_status on public.booking_payments (status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_room_time_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_room_time_no_overlap
      exclude using gist (
        room_id with =,
        tstzrange(start_at, end_at, '[)') with &&
      )
      where (
        booking_type = 'hotel'
        and status in ('pending', 'confirmed', 'in_progress')
        and room_id is not null
      );
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_pets_updated_at on public.pets;
create trigger trg_pets_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_settings_updated_at on public.shop_settings;
create trigger trg_shop_settings_updated_at
before update on public.shop_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_booking_payments_updated_at on public.booking_payments;
create trigger trg_booking_payments_updated_at
before update on public.booking_payments
for each row execute function public.set_updated_at();

create or replace function public.generate_booking_no()
returns text
language plpgsql
as $$
declare
  booking_prefix text;
  next_seq integer;
begin
  booking_prefix := ''BK'' || to_char(current_date, ''YYYYMMDD'') || ''-'';

  select coalesce(
    max(
      case
        when booking_no like booking_prefix || ''%'' then right(booking_no, 4)::integer
        else 0
      end
    ),
    0
  ) + 1
  into next_seq
  from public.bookings
  where booking_no like booking_prefix || ''%'';

  return booking_prefix || lpad(next_seq::text, 4, ''0'');
end;
$$;

create or replace function public.check_grooming_conflict(
  p_pet_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid default null,
  p_capacity integer default 3
)
returns boolean
language sql
stable
as $$
  with overlapping as (
    select count(*) as active_count
    from public.bookings b
    where b.booking_type = 'grooming'
      and b.status in ('pending', 'confirmed', 'in_progress')
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  ),
  same_pet as (
    select exists (
      select 1
      from public.bookings b
      where (b.pet_id = p_pet_id or b.secondary_pet_id = p_pet_id)
        and b.status in ('pending', 'confirmed', 'in_progress')
        and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    ) as has_conflict
  )
  select (select has_conflict from same_pet) or ((select active_count from overlapping) >= p_capacity);
$$;

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
    case
      when coalesce(bp.amount, 0) >= b.total_amount and b.total_amount > 0 then 'paid'::public.payment_status
      else coalesce(bp.status, 'pending'::public.payment_status)
    end as payment_status,
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
  group by b.id, c.full_name, p1.name, p2.name, r.name, bp.status, bp.amount
  order by b.start_at, b.created_at;
$$;

create or replace function public.get_available_rooms(
  p_check_in timestamptz,
  p_check_out timestamptz
)
returns table (
  room_id uuid,
  code text,
  name text,
  room_type text,
  nightly_rate numeric
)
language sql
stable
as $$
  select
    r.id as room_id,
    r.code,
    r.name,
    r.room_type,
    r.nightly_rate
  from public.rooms r
  where r.is_active = true
    and not exists (
      select 1
      from public.bookings b
      where b.room_id = r.id
        and b.booking_type = 'hotel'
        and b.status in ('pending', 'confirmed', 'in_progress')
        and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_check_in, p_check_out, '[)')
    )
  order by r.code;
$$;

create or replace function public.get_finance_summary(p_day date)
returns table (
  income_total numeric,
  expense_total numeric,
  net_total numeric
)
language sql
stable
as $$
  select
    coalesce(sum(case when transaction_type = 'income' then amount else 0 end), 0) as income_total,
    coalesce(sum(case when transaction_type = 'expense' then amount else 0 end), 0) as expense_total,
    coalesce(sum(case when transaction_type = 'income' then amount else -amount end), 0) as net_total
  from public.cash_transactions
  where transaction_date = p_day;
$$;

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

alter table public.app_users enable row level security;
alter table public.customers enable row level security;
alter table public.pets enable row level security;
alter table public.services enable row level security;
alter table public.rooms enable row level security;
alter table public.shop_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.booking_payments enable row level security;

drop policy if exists app_users_select_own_profile on public.app_users;
create policy app_users_select_own_profile
on public.app_users
for select
using (auth.uid() = id);

drop policy if exists app_users_admin_read_all on public.app_users;
create policy app_users_admin_read_all
on public.app_users
for select
using (public.is_admin());

drop policy if exists customers_active_app_users_select on public.customers;
create policy customers_active_app_users_select
on public.customers
for select
using (public.is_active_app_user());

drop policy if exists customers_active_app_users_insert on public.customers;
create policy customers_active_app_users_insert
on public.customers
for insert
with check (public.is_active_app_user());

drop policy if exists customers_active_app_users_update on public.customers;
create policy customers_active_app_users_update
on public.customers
for update
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists pets_active_app_users_select on public.pets;
create policy pets_active_app_users_select
on public.pets
for select
using (public.is_active_app_user());

drop policy if exists pets_active_app_users_insert on public.pets;
create policy pets_active_app_users_insert
on public.pets
for insert
with check (public.is_active_app_user());

drop policy if exists pets_active_app_users_update on public.pets;
create policy pets_active_app_users_update
on public.pets
for update
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists services_active_app_users_select on public.services;
create policy services_active_app_users_select
on public.services
for select
using (public.is_active_app_user());

drop policy if exists rooms_active_app_users_select on public.rooms;
create policy rooms_active_app_users_select
on public.rooms
for select
using (public.is_active_app_user());

drop policy if exists shop_settings_active_app_users_select on public.shop_settings;
create policy shop_settings_active_app_users_select
on public.shop_settings
for select
using (public.is_active_app_user());

drop policy if exists bookings_active_app_users_select on public.bookings;
create policy bookings_active_app_users_select
on public.bookings
for select
using (public.is_active_app_user());

drop policy if exists bookings_active_app_users_insert on public.bookings;
create policy bookings_active_app_users_insert
on public.bookings
for insert
with check (public.is_active_app_user());

drop policy if exists bookings_active_app_users_update on public.bookings;
create policy bookings_active_app_users_update
on public.bookings
for update
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete
on public.bookings
for delete
using (public.is_admin());

drop policy if exists booking_items_active_app_users_select on public.booking_items;
create policy booking_items_active_app_users_select
on public.booking_items
for select
using (public.is_active_app_user());

drop policy if exists booking_items_active_app_users_insert on public.booking_items;
create policy booking_items_active_app_users_insert
on public.booking_items
for insert
with check (public.is_active_app_user());

drop policy if exists booking_items_active_app_users_update on public.booking_items;
create policy booking_items_active_app_users_update
on public.booking_items
for update
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists booking_items_admin_delete on public.booking_items;
create policy booking_items_admin_delete
on public.booking_items
for delete
using (public.is_admin());

drop policy if exists cash_transactions_admin_or_booking_income_select on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_select
on public.cash_transactions
for select
using (
  public.is_admin()
  or (
    public.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_insert on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_insert
on public.cash_transactions
for insert
with check (
  public.is_admin()
  or (
    public.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_update on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_update
on public.cash_transactions
for update
using (
  public.is_admin()
  or (
    public.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
)
with check (
  public.is_admin()
  or (
    public.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_delete on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_delete
on public.cash_transactions
for delete
using (
  public.is_admin()
  or (
    public.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists booking_payments_active_app_users_select on public.booking_payments;
create policy booking_payments_active_app_users_select
on public.booking_payments
for select
using (public.is_active_app_user());

drop policy if exists booking_payments_active_app_users_insert on public.booking_payments;
create policy booking_payments_active_app_users_insert
on public.booking_payments
for insert
with check (public.is_active_app_user());

drop policy if exists booking_payments_active_app_users_update on public.booking_payments;
create policy booking_payments_active_app_users_update
on public.booking_payments
for update
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists booking_payments_active_app_users_delete on public.booking_payments;
create policy booking_payments_active_app_users_delete
on public.booking_payments
for delete
using (public.is_active_app_user());

