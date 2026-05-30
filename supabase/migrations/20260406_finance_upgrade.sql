create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('income', 'expense');
  end if;
end
$$;

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type public.transaction_type not null,
  booking_id uuid references public.bookings (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  amount numeric(10,2) not null,
  payment_method text not null default 'cash',
  transaction_date date not null default current_date,
  note text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cash_transactions_amount_chk check (amount > 0),
  constraint cash_transactions_payment_method_chk check (payment_method in ('cash', 'transfer', 'card', 'other'))
);

alter table public.cash_transactions
  add column if not exists category text not null default 'service_income';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_transactions_category_chk'
  ) then
    alter table public.cash_transactions
      add constraint cash_transactions_category_chk check (
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
      );
  end if;
end
$$;

create index if not exists idx_cash_transactions_date on public.cash_transactions (transaction_date desc);
create index if not exists idx_cash_transactions_type_date on public.cash_transactions (transaction_type, transaction_date desc);
create index if not exists idx_cash_transactions_booking_id on public.cash_transactions (booking_id);

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
