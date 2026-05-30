alter table public.bookings
  add column if not exists secondary_pet_id uuid references public.pets (id) on delete restrict;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_distinct_pets_chk'
  ) then
    alter table public.bookings
      add constraint bookings_distinct_pets_chk
      check (secondary_pet_id is null or secondary_pet_id <> pet_id);
  end if;
end
$$;

create index if not exists idx_bookings_secondary_pet_id on public.bookings (secondary_pet_id);

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
  left join public.booking_items bi on bi.booking_id = b.id
  left join public.services s on s.id = bi.service_id
  where tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_day::timestamptz, (p_day + 1)::timestamptz, '[)')
  group by b.id, c.full_name, p1.name, p2.name, r.name
  order by b.start_at, b.created_at;
$$;
