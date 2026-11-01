-- NULL keeps the original whole-booking split for historical / other services.
alter table public.bookings
  add column if not exists grooming_allocation jsonb;

comment on column public.bookings.grooming_allocation is
  'Fixed grooming profile and staff IDs per stage. bath_only: 10/30/60; bath_and_haircut: 5/20/30/45. Two workers share a stage equally.';
