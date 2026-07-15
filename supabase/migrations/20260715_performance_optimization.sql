create extension if not exists pg_trgm;

create or replace function public.normalize_customer_phone(value text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(value, '[^0-9+]', '', 'g');
$$;

alter table public.customers
  add column if not exists normalized_phone text
  generated always as (public.normalize_customer_phone(phone)) stored;

do $$
begin
  if exists (
    select 1
    from public.customers
    group by normalized_phone
    having count(*) > 1
  ) then
    raise exception 'Cannot create normalized phone unique index: duplicate normalized customer phone numbers exist';
  end if;
end
$$;

create unique index if not exists idx_customers_normalized_phone_unique
  on public.customers (normalized_phone);

create index if not exists idx_bookings_done_start_at
  on public.bookings (start_at desc)
  where status = 'done';

create index if not exists idx_bookings_done_type_start_at
  on public.bookings (booking_type, start_at desc)
  where status = 'done';

create index if not exists idx_cash_transactions_booking_type_date_created
  on public.cash_transactions (booking_id, transaction_type, transaction_date, created_at)
  where booking_id is not null;

create or replace function public.search_customers(p_query text default '', p_limit integer default 25)
returns table (
  id uuid,
  full_name text,
  phone text,
  facebook_name text,
  note text
)
language sql
stable
as $$
  with settings as (
    select trim(coalesce(p_query, '')) as query, least(greatest(coalesce(p_limit, 25), 1), 80) as row_limit
  ), ranked as (
    select c.id, c.full_name, c.phone, c.facebook_name, c.note, c.created_at, 0 as priority
    from public.customers c, settings s
    where c.is_active = true
      and s.query = ''

    union all

    select c.id, c.full_name, c.phone, c.facebook_name, c.note, c.created_at,
      case
        when c.normalized_phone = public.normalize_customer_phone(s.query) then 0
        when c.full_name ilike '%' || s.query || '%' then 1
        when c.phone ilike '%' || s.query || '%' then 2
        when c.facebook_name ilike '%' || s.query || '%' then 3
        else 4
      end as priority
    from public.customers c, settings s
    where c.is_active = true
      and s.query <> ''
      and (
        c.normalized_phone = public.normalize_customer_phone(s.query)
        or c.full_name ilike '%' || s.query || '%'
        or c.phone ilike '%' || s.query || '%'
        or c.facebook_name ilike '%' || s.query || '%'
        or exists (
          select 1
          from public.pets p
          where p.customer_id = c.id
            and p.is_active = true
            and p.name ilike '%' || s.query || '%'
        )
      )
  ), deduplicated as (
    select distinct on (ranked.id)
      ranked.id, ranked.full_name, ranked.phone, ranked.facebook_name, ranked.note, ranked.created_at, ranked.priority
    from ranked
    order by ranked.id, ranked.priority
  )
  select d.id, d.full_name, d.phone, d.facebook_name, d.note
  from deduplicated d, settings s
  order by d.priority, d.created_at desc
  limit (select row_limit from settings);
$$;

create or replace function public.search_pets(p_query text default '', p_limit integer default 25)
returns table (
  id uuid,
  customer_id uuid,
  name text,
  species text,
  breed text,
  weight_kg numeric
)
language sql
stable
as $$
  with settings as (
    select trim(coalesce(p_query, '')) as query, least(greatest(coalesce(p_limit, 25), 1), 80) as row_limit
  )
  select p.id, p.customer_id, p.name, p.species, p.breed, p.weight_kg
  from public.pets p
  join public.customers c on c.id = p.customer_id
  cross join settings s
  where p.is_active = true
    and (
      s.query = ''
      or p.name ilike '%' || s.query || '%'
      or p.species ilike '%' || s.query || '%'
      or p.breed ilike '%' || s.query || '%'
      or c.full_name ilike '%' || s.query || '%'
    )
  order by
    case when s.query <> '' and p.name ilike '%' || s.query || '%' then 0 else 1 end,
    p.created_at desc
  limit (select row_limit from settings);
$$;

create or replace function public.get_marketing_lifetime_customers(
  p_end_exclusive timestamptz,
  p_booking_type public.booking_type default null
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  facebook_name text,
  customer_created_at timestamptz,
  last_booking_at timestamptz,
  booking_count bigint,
  total_spend numeric,
  pet_summary text
)
language sql
stable
as $$
  with completed as (
    select b.customer_id, b.pet_id, b.secondary_pet_id, b.start_at, b.total_amount
    from public.bookings b
    where b.status = 'done'
      and b.start_at < p_end_exclusive
      and (p_booking_type is null or b.booking_type = p_booking_type)
  ), customer_totals as (
    select
      c.customer_id,
      max(c.start_at) as last_booking_at,
      count(*) as booking_count,
      sum(c.total_amount) as total_spend
    from completed c
    group by c.customer_id
  ), customer_pets as (
    select pet_ids.customer_id,
      string_agg(distinct p.name || ' (' || p.species || ')', ', ' order by p.name || ' (' || p.species || ')') as pet_summary
    from (
      select customer_id, pet_id as pet_id from completed
      union all
      select customer_id, secondary_pet_id from completed where secondary_pet_id is not null
    ) pet_ids
    join public.pets p on p.id = pet_ids.pet_id
    group by pet_ids.customer_id
  )
  select
    ct.customer_id,
    c.full_name,
    c.phone,
    c.facebook_name,
    c.created_at,
    ct.last_booking_at,
    ct.booking_count,
    ct.total_spend,
    coalesce(cp.pet_summary, '-')
  from customer_totals ct
  join public.customers c on c.id = ct.customer_id
  left join customer_pets cp on cp.customer_id = ct.customer_id;
$$;

create or replace function public.get_finance_report_summary(
  p_start_date date,
  p_end_date date,
  p_transaction_type public.transaction_type default null
)
returns table (
  income_total numeric,
  expense_total numeric,
  net_total numeric,
  service_income_total numeric,
  hotel_income_total numeric,
  other_income_total numeric,
  deposit_total numeric,
  income_by_payment_method jsonb
)
language sql
stable
as $$
  with range_transactions as (
    select ct.*
    from public.cash_transactions ct
    where ct.transaction_date between p_start_date and p_end_date
      and (p_transaction_type is null or ct.transaction_type = p_transaction_type)
  )
  select
    coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income'), 0),
    coalesce(sum(rt.amount) filter (where rt.transaction_type = 'expense'), 0),
    coalesce(sum(case when rt.transaction_type = 'income' then rt.amount else -rt.amount end), 0),
    coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.category = 'service_income'), 0),
    coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.category = 'hotel_income'), 0),
    coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.category not in ('service_income', 'hotel_income')), 0),
    coalesce(sum(rt.amount) filter (
      where rt.transaction_type = 'income'
        and exists (
          select 1 from public.booking_payments bp
          where bp.booking_id = rt.booking_id and bp.status = 'pending'
        )
    ), 0),
    jsonb_build_object(
      'cash', coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.payment_method = 'cash'), 0),
      'promptpay_qr', coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.payment_method = 'promptpay_qr'), 0),
      'transfer', coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.payment_method = 'transfer'), 0),
      'card', coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.payment_method = 'card'), 0),
      'other', coalesce(sum(rt.amount) filter (where rt.transaction_type = 'income' and rt.payment_method = 'other'), 0)
    )
  from range_transactions rt;
$$;

create schema if not exists private;

create table if not exists private.booking_number_counters (
  counter_date date primary key,
  last_value integer not null check (last_value > 0)
);

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
language plpgsql
security definer
set search_path = public, private
as $$
declare
  booking_id uuid;
  booking_day date := (now() at time zone 'Asia/Bangkok')::date;
  booking_sequence integer;
  booking_number text;
  selected_pet_count integer := case when p_secondary_pet_id is null then 1 else 2 end;
  room_capacity integer;
begin
  if p_end_at <= p_start_at then
    raise exception 'End time must be after start time';
  end if;

  if p_secondary_pet_id = p_pet_id then
    raise exception 'Primary and secondary pets must be different';
  end if;

  if (select count(*) from public.pets p where p.id in (p_pet_id, p_secondary_pet_id) and p.customer_id = p_customer_id) <> selected_pet_count then
    raise exception 'Selected pets do not belong to the selected customer';
  end if;

  if p_booking_type = 'grooming' then
    if public.check_grooming_conflict(p_pet_id, p_start_at, p_end_at, null, 3)
      or (p_secondary_pet_id is not null and public.check_grooming_conflict(p_secondary_pet_id, p_start_at, p_end_at, null, 3)) then
      raise exception 'Grooming time is no longer available';
    end if;
  end if;

  if p_booking_type = 'hotel' then
    select r.max_pets into room_capacity from public.rooms r where r.id = p_room_id and r.is_active = true;
    if room_capacity is null or room_capacity < selected_pet_count then
      raise exception 'Selected room is unavailable or has insufficient capacity';
    end if;
  end if;

  insert into private.booking_number_counters(counter_date, last_value)
  values (booking_day, 1)
  on conflict (counter_date) do update
    set last_value = private.booking_number_counters.last_value + 1
  returning last_value into booking_sequence;

  booking_number := 'BK' || to_char(booking_day, 'YYYYMMDD') || '-' || lpad(booking_sequence::text, 4, '0');

  insert into public.bookings (
    booking_no, booking_type, customer_id, pet_id, secondary_pet_id, room_id,
    start_at, end_at, total_amount, note, created_by
  ) values (
    booking_number, p_booking_type, p_customer_id, p_pet_id, p_secondary_pet_id, p_room_id,
    p_start_at, p_end_at, p_total_amount, p_note, p_actor_user_id
  ) returning id into booking_id;

  insert into public.booking_items (booking_id, service_id, qty, unit_price, duration_minutes, note)
  select booking_id, item.service_id, item.qty, item.unit_price, item.duration_minutes, item.note
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    service_id uuid,
    qty integer,
    unit_price numeric,
    duration_minutes integer,
    note text
  );

  return booking_id;
end;
$$;

revoke all on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) from public;
grant execute on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) to service_role;

create or replace function public.sync_booking_income_transaction_atomic(
  p_booking_id uuid,
  p_booking_type public.booking_type,
  p_booking_no text,
  p_customer_id uuid,
  p_amount numeric,
  p_method text,
  p_note text,
  p_transaction_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_amount numeric := 0;
  amount_delta numeric;
  remaining_to_reduce numeric;
  income_row record;
  income_category text := case when p_booking_type = 'hotel' then 'hotel_income' else 'service_income' end;
  income_title text := case when p_booking_type = 'hotel' then 'ชำระค่าโรงแรม ' else 'ชำระค่าบริการ ' end || p_booking_no;
begin
  select coalesce(sum(ct.amount), 0)
  into existing_amount
  from public.cash_transactions ct
  where ct.booking_id = p_booking_id and ct.transaction_type = 'income';

  amount_delta := round(p_amount - existing_amount, 2);

  if p_amount <= 0 then
    delete from public.cash_transactions where booking_id = p_booking_id and transaction_type = 'income';
    return;
  end if;

  if amount_delta > 0 then
    insert into public.cash_transactions (
      transaction_type, category, booking_id, customer_id, title, amount,
      payment_method, transaction_date, note
    ) values (
      'income', income_category, p_booking_id, p_customer_id, income_title, amount_delta,
      p_method, p_transaction_date, p_note
    );
    return;
  end if;

  if amount_delta < 0 then
    remaining_to_reduce := abs(amount_delta);
    for income_row in
      select ct.id, ct.amount
      from public.cash_transactions ct
      where ct.booking_id = p_booking_id and ct.transaction_type = 'income'
      order by ct.transaction_date desc, ct.created_at desc
      for update
    loop
      exit when remaining_to_reduce <= 0;
      if income_row.amount <= remaining_to_reduce then
        delete from public.cash_transactions where id = income_row.id;
        remaining_to_reduce := round(remaining_to_reduce - income_row.amount, 2);
      else
        update public.cash_transactions
        set amount = round(income_row.amount - remaining_to_reduce, 2),
            category = income_category,
            customer_id = p_customer_id,
            title = income_title,
            payment_method = p_method,
            note = p_note
        where id = income_row.id;
        remaining_to_reduce := 0;
      end if;
    end loop;

    if remaining_to_reduce > 0 then
      raise exception 'Unable to reconcile booking income transactions';
    end if;
    return;
  end if;

  update public.cash_transactions
  set category = income_category,
      customer_id = p_customer_id,
      title = income_title,
      payment_method = p_method,
      note = p_note
  where id = (
    select ct.id from public.cash_transactions ct
    where ct.booking_id = p_booking_id and ct.transaction_type = 'income'
    order by ct.transaction_date desc, ct.created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.sync_booking_income_transaction_atomic(uuid, public.booking_type, text, uuid, numeric, text, text, date) from public;
grant execute on function public.sync_booking_income_transaction_atomic(uuid, public.booking_type, text, uuid, numeric, text, text, date) to service_role;

create index if not exists idx_bookings_non_cancelled_status_start_at
  on public.bookings (status, start_at)
  where status <> 'cancelled';

create or replace function public.get_unpaid_bookings()
returns table (
  booking_id uuid, booking_no text, booking_type public.booking_type,
  status public.booking_status, payment_status public.payment_status,
  start_at timestamptz, end_at timestamptz, customer_name text,
  customer_phone text, pet_name text, room_name text, services_summary text,
  total_amount numeric, paid_amount numeric
)
language sql stable security definer set search_path = public
as $$
  select b.id, b.booking_no, b.booking_type, b.status,
    case when coalesce(bp.amount, 0) >= b.total_amount then 'paid'::public.payment_status
         else coalesce(bp.status, 'pending'::public.payment_status) end,
    b.start_at, b.end_at, c.full_name, c.phone,
    concat_ws(', ', p.name, sp.name), r.name, coalesce(si.services_summary, ''),
    b.total_amount, coalesce(bp.amount, 0)
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.pets p on p.id = b.pet_id
  left join public.pets sp on sp.id = b.secondary_pet_id
  left join public.rooms r on r.id = b.room_id
  left join public.booking_payments bp on bp.booking_id = b.id
  left join lateral (
    select string_agg(s.name, ', ' order by s.name) as services_summary
    from public.booking_items bi join public.services s on s.id = bi.service_id
    where bi.booking_id = b.id
  ) si on true
  where b.status <> 'cancelled' and b.total_amount > 0
    and coalesce(bp.amount, 0) < b.total_amount
  order by b.start_at asc, b.created_at asc;
$$;

revoke all on function public.get_unpaid_bookings() from public;
grant execute on function public.get_unpaid_bookings() to service_role;

create or replace function public.get_dashboard_queue_counts(p_day date)
returns table (today_all bigint, today_pending bigint, today_done bigint, unpaid bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where day_booking.id is not null),
    count(*) filter (where day_booking.status in ('pending', 'confirmed', 'in_progress')),
    count(*) filter (where day_booking.status = 'done'),
    (select count(*)
     from public.bookings ub
     left join public.booking_payments up on up.booking_id = ub.id
     where ub.status <> 'cancelled' and ub.total_amount > 0
       and coalesce(up.amount, 0) < ub.total_amount)
  from (
    select b.id, b.status
    from public.bookings b
    where tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_day::timestamptz, (p_day + 1)::timestamptz, '[)')
  ) day_booking;
$$;

revoke all on function public.get_dashboard_queue_counts(date) from public;
grant execute on function public.get_dashboard_queue_counts(date) to service_role;

-- Backfill and repair booking number counters before using them for new bookings.
insert into private.booking_number_counters (counter_date, last_value)
select
  to_date(substring(b.booking_no from '^BK([0-9]{8})-'), 'YYYYMMDD'),
  greatest(max((substring(b.booking_no from '-([0-9]+)$'))::integer), 1)
from public.bookings b
where b.booking_no ~ '^BK[0-9]{8}-[0-9]+$'
group by to_date(substring(b.booking_no from '^BK([0-9]{8})-'), 'YYYYMMDD')
on conflict (counter_date) do update
set last_value = greatest(private.booking_number_counters.last_value, excluded.last_value);

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
language plpgsql
security definer
set search_path = public, private
as $$
declare
  booking_id uuid;
  booking_day date := (now() at time zone 'Asia/Bangkok')::date;
  booking_sequence integer;
  booking_number text;
  duplicate_booking_no text;
  max_existing_sequence integer;
  selected_pet_count integer := case when p_secondary_pet_id is null then 1 else 2 end;
  room_capacity integer;
  canonical_items jsonb;
  duplicate_fingerprint text;
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
    raise exception using
      errcode = '23505',
      message = 'Duplicate booking already exists: ' || duplicate_booking_no;
  end if;

  if p_end_at <= p_start_at then
    raise exception 'End time must be after start time';
  end if;
  if p_secondary_pet_id = p_pet_id then
    raise exception 'Primary and secondary pets must be different';
  end if;
  if (select count(*) from public.pets p where p.id in (p_pet_id, p_secondary_pet_id) and p.customer_id = p_customer_id) <> selected_pet_count then
    raise exception 'Selected pets do not belong to the selected customer';
  end if;
  if p_booking_type = 'grooming' then
    if public.check_grooming_conflict(p_pet_id, p_start_at, p_end_at, null, 3)
      or (p_secondary_pet_id is not null and public.check_grooming_conflict(p_secondary_pet_id, p_start_at, p_end_at, null, 3)) then
      raise exception 'Grooming time is no longer available';
    end if;
  end if;
  if p_booking_type = 'hotel' then
    select r.max_pets into room_capacity from public.rooms r where r.id = p_room_id and r.is_active = true;
    if room_capacity is null or room_capacity < selected_pet_count then
      raise exception 'Selected room is unavailable or has insufficient capacity';
    end if;
  end if;

  select coalesce(max((substring(b.booking_no from '-([0-9]+)$'))::integer), 0)
  into max_existing_sequence
  from public.bookings b
  where b.booking_no like 'BK' || to_char(booking_day, 'YYYYMMDD') || '-%';

  insert into private.booking_number_counters(counter_date, last_value)
  values (booking_day, greatest(max_existing_sequence + 1, 1))
  on conflict (counter_date) do update
    set last_value = greatest(private.booking_number_counters.last_value + 1, excluded.last_value)
  returning last_value into booking_sequence;

  booking_number := 'BK' || to_char(booking_day, 'YYYYMMDD') || '-' || lpad(booking_sequence::text, 4, '0');
  insert into public.bookings (
    booking_no, booking_type, customer_id, pet_id, secondary_pet_id, room_id,
    start_at, end_at, total_amount, note, created_by
  ) values (
    booking_number, p_booking_type, p_customer_id, p_pet_id, p_secondary_pet_id, p_room_id,
    p_start_at, p_end_at, p_total_amount, p_note, p_actor_user_id
  ) returning id into booking_id;

  insert into public.booking_items (booking_id, service_id, qty, unit_price, duration_minutes, note)
  select booking_id, item.service_id, item.qty, item.unit_price, item.duration_minutes, item.note
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    service_id uuid, qty integer, unit_price numeric, duration_minutes integer, note text
  );
  return booking_id;
end;
$$;

revoke all on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) from public;
grant execute on function public.create_booking_atomic(public.booking_type, uuid, uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, uuid, jsonb) to service_role;
