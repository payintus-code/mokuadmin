create schema if not exists private;

create or replace function private.current_app_role()
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

create or replace function private.is_active_app_user()
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

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_active_app_user() from public;
revoke all on function private.is_admin() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.current_app_role() to anon, authenticated, service_role;
grant execute on function private.is_active_app_user() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

drop policy if exists app_users_admin_read_all on public.app_users;
create policy app_users_admin_read_all
on public.app_users
for select
using (private.is_admin());

drop policy if exists customers_active_app_users_select on public.customers;
create policy customers_active_app_users_select
on public.customers
for select
using (private.is_active_app_user());

drop policy if exists customers_active_app_users_insert on public.customers;
create policy customers_active_app_users_insert
on public.customers
for insert
with check (private.is_active_app_user());

drop policy if exists customers_active_app_users_update on public.customers;
create policy customers_active_app_users_update
on public.customers
for update
using (private.is_active_app_user())
with check (private.is_active_app_user());

drop policy if exists pets_active_app_users_select on public.pets;
create policy pets_active_app_users_select
on public.pets
for select
using (private.is_active_app_user());

drop policy if exists pets_active_app_users_insert on public.pets;
create policy pets_active_app_users_insert
on public.pets
for insert
with check (private.is_active_app_user());

drop policy if exists pets_active_app_users_update on public.pets;
create policy pets_active_app_users_update
on public.pets
for update
using (private.is_active_app_user())
with check (private.is_active_app_user());

drop policy if exists services_active_app_users_select on public.services;
create policy services_active_app_users_select
on public.services
for select
using (private.is_active_app_user());

drop policy if exists rooms_active_app_users_select on public.rooms;
create policy rooms_active_app_users_select
on public.rooms
for select
using (private.is_active_app_user());

drop policy if exists shop_settings_active_app_users_select on public.shop_settings;
create policy shop_settings_active_app_users_select
on public.shop_settings
for select
using (private.is_active_app_user());

drop policy if exists bookings_active_app_users_select on public.bookings;
create policy bookings_active_app_users_select
on public.bookings
for select
using (private.is_active_app_user());

drop policy if exists bookings_active_app_users_insert on public.bookings;
create policy bookings_active_app_users_insert
on public.bookings
for insert
with check (private.is_active_app_user());

drop policy if exists bookings_active_app_users_update on public.bookings;
create policy bookings_active_app_users_update
on public.bookings
for update
using (private.is_active_app_user())
with check (private.is_active_app_user());

drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete
on public.bookings
for delete
using (private.is_admin());

drop policy if exists booking_items_active_app_users_select on public.booking_items;
create policy booking_items_active_app_users_select
on public.booking_items
for select
using (private.is_active_app_user());

drop policy if exists booking_items_active_app_users_insert on public.booking_items;
create policy booking_items_active_app_users_insert
on public.booking_items
for insert
with check (private.is_active_app_user());

drop policy if exists booking_items_active_app_users_update on public.booking_items;
create policy booking_items_active_app_users_update
on public.booking_items
for update
using (private.is_active_app_user())
with check (private.is_active_app_user());

drop policy if exists booking_items_admin_delete on public.booking_items;
create policy booking_items_admin_delete
on public.booking_items
for delete
using (private.is_admin());

drop policy if exists cash_transactions_admin_or_booking_income_select on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_select
on public.cash_transactions
for select
using (
  private.is_admin()
  or (
    private.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_insert on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_insert
on public.cash_transactions
for insert
with check (
  private.is_admin()
  or (
    private.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_update on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_update
on public.cash_transactions
for update
using (
  private.is_admin()
  or (
    private.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
)
with check (
  private.is_admin()
  or (
    private.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists cash_transactions_admin_or_booking_income_delete on public.cash_transactions;
create policy cash_transactions_admin_or_booking_income_delete
on public.cash_transactions
for delete
using (
  private.is_admin()
  or (
    private.is_active_app_user()
    and booking_id is not null
    and transaction_type = 'income'
  )
);

drop policy if exists booking_payments_active_app_users_select on public.booking_payments;
create policy booking_payments_active_app_users_select
on public.booking_payments
for select
using (private.is_active_app_user());

drop policy if exists booking_payments_active_app_users_insert on public.booking_payments;
create policy booking_payments_active_app_users_insert
on public.booking_payments
for insert
with check (private.is_active_app_user());

drop policy if exists booking_payments_active_app_users_update on public.booking_payments;
create policy booking_payments_active_app_users_update
on public.booking_payments
for update
using (private.is_active_app_user())
with check (private.is_active_app_user());

drop policy if exists booking_payments_active_app_users_delete on public.booking_payments;
create policy booking_payments_active_app_users_delete
on public.booking_payments
for delete
using (private.is_active_app_user());

drop function if exists public.is_admin();
drop function if exists public.is_active_app_user();
drop function if exists public.current_app_role();
