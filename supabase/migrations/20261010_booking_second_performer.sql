alter table public.bookings
  add column if not exists secondary_performed_by uuid references public.app_users (id) on delete set null;

create index if not exists idx_bookings_secondary_performed_by on public.bookings (secondary_performed_by);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_distinct_performers_check'
  ) then
    alter table public.bookings
      add constraint bookings_distinct_performers_check
      check (performed_by is null or secondary_performed_by is null or performed_by <> secondary_performed_by);
  end if;
end
$$;
