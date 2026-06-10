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
