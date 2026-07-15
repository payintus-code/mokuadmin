create schema if not exists private;

create table if not exists private.booking_number_counters (
  counter_date date primary key,
  last_value integer not null check (last_value > 0)
);

insert into private.booking_number_counters (counter_date, last_value)
select
  to_date(substring(b.booking_no from '^BK([0-9]{8})-'), 'YYYYMMDD'),
  greatest(max((substring(b.booking_no from '-([0-9]+)$'))::integer), 1)
from public.bookings b
where b.booking_no ~ '^BK[0-9]{8}-[0-9]+$'
group by to_date(substring(b.booking_no from '^BK([0-9]{8})-'), 'YYYYMMDD')
on conflict (counter_date) do update
set last_value = greatest(private.booking_number_counters.last_value, excluded.last_value);

alter function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb)
rename to create_booking_atomic_legacy;

create or replace function public.create_booking_atomic_guarded(
  p_booking_type public.booking_type,
  p_customer_id uuid,
  p_pet_id uuid,
  p_secondary_pet_id uuid,
  p_room_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_total_amount numeric,
  p_note text,
  p_actor_user_id uuid,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  duplicate_booking_no text;
  canonical_items jsonb;
  duplicate_fingerprint text;
  booking_day date := (now() at time zone 'Asia/Bangkok')::date;
  max_existing_sequence integer;
begin
  canonical_items := coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'service_id', item.service_id,
        'qty', item.qty,
        'unit_price', item.unit_price,
        'duration_minutes', item.duration_minutes,
        'note', item.note
      ) order by item.service_id, item.qty, item.unit_price, item.duration_minutes, item.note
    )
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
      service_id uuid,
      qty integer,
      unit_price numeric,
      duration_minutes integer,
      note text
    )
  ), '[]'::jsonb);

  duplicate_fingerprint := concat_ws('|',
    p_booking_type::text,
    p_customer_id::text,
    p_pet_id::text,
    coalesce(p_secondary_pet_id::text, ''),
    coalesce(p_room_id::text, ''),
    p_start_at::text,
    p_end_at::text,
    p_total_amount::text,
    coalesce(p_note, ''),
    canonical_items::text
  );
  perform pg_advisory_xact_lock(hashtextextended(duplicate_fingerprint, 0));

  select b.booking_no
  into duplicate_booking_no
  from public.bookings b
  where b.status <> 'cancelled'
    and b.booking_type = p_booking_type
    and b.customer_id = p_customer_id
    and b.pet_id = p_pet_id
    and b.secondary_pet_id is not distinct from p_secondary_pet_id
    and b.room_id is not distinct from p_room_id
    and b.start_at = p_start_at
    and b.end_at = p_end_at
    and b.total_amount = p_total_amount
    and b.note is not distinct from p_note
    and coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'service_id', bi.service_id,
          'qty', bi.qty,
          'unit_price', bi.unit_price,
          'duration_minutes', bi.duration_minutes,
          'note', bi.note
        ) order by bi.service_id, bi.qty, bi.unit_price, bi.duration_minutes, bi.note
      )
      from public.booking_items bi
      where bi.booking_id = b.id
    ), '[]'::jsonb) = canonical_items
  order by b.created_at
  limit 1;

  if duplicate_booking_no is not null then
    raise exception using errcode = '23505', message = 'Duplicate booking already exists: ' || duplicate_booking_no;
  end if;

  select coalesce(max((substring(b.booking_no from '-([0-9]+)$'))::integer), 0)
  into max_existing_sequence
  from public.bookings b
  where b.booking_no like 'BK' || to_char(booking_day, 'YYYYMMDD') || '-%';

  insert into private.booking_number_counters (counter_date, last_value)
  values (booking_day, greatest(max_existing_sequence, 1))
  on conflict (counter_date) do update
    set last_value = greatest(private.booking_number_counters.last_value, excluded.last_value);

  return public.create_booking_atomic_legacy(
    p_booking_type, p_customer_id, p_pet_id, p_secondary_pet_id, p_room_id,
    p_start_at, p_end_at, p_total_amount, p_note, p_actor_user_id, p_items
  );
end;
$$;

create or replace function public.create_booking_atomic(
  p_booking_type public.booking_type,
  p_customer_id uuid,
  p_pet_id uuid,
  p_secondary_pet_id uuid,
  p_room_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_total_amount numeric,
  p_note text,
  p_actor_user_id uuid,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select public.create_booking_atomic_guarded(
    p_booking_type, p_customer_id, p_pet_id, p_secondary_pet_id, p_room_id,
    p_start_at, p_end_at, p_total_amount, p_note, p_actor_user_id, p_items
  );
$$;

revoke all on function public.create_booking_atomic_guarded(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) from public;
grant execute on function public.create_booking_atomic_guarded(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) to service_role;
revoke all on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) from public;
grant execute on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) to service_role;
