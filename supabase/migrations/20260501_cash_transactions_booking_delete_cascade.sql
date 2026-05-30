alter table public.cash_transactions
  drop constraint if exists cash_transactions_booking_id_fkey;

alter table public.cash_transactions
  add constraint cash_transactions_booking_id_fkey
  foreign key (booking_id)
  references public.bookings (id)
  on delete cascade;
