create or replace function public.get_daily_schedule(p_day date)
returns table (
  booking_id uuid,
  booking_no text,
  booking_type public.booking_type,
  status public.booking_status,
  payment_status public.payment_status,
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
    case
      when coalesce(bp.amount, 0) >= b.total_amount and b.total_amount > 0 then 'paid'::public.payment_status
      else coalesce(bp.status, 'pending'::public.payment_status)
    end as payment_status,
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
  left join public.booking_payments bp on bp.booking_id = b.id
  left join public.booking_items bi on bi.booking_id = b.id
  left join public.services s on s.id = bi.service_id
  where tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_day::timestamptz, (p_day + 1)::timestamptz, '[)')
  group by b.id, c.full_name, p1.name, p2.name, r.name, bp.status, bp.amount
  order by b.start_at, b.created_at;
$$;
