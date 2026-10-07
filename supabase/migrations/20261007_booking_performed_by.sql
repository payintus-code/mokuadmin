alter table public.bookings
  add column if not exists performed_by uuid references public.app_users (id) on delete set null;

create index if not exists idx_bookings_performed_by on public.bookings (performed_by);

