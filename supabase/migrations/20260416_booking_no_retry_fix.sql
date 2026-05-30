create or replace function public.generate_booking_no()
returns text
language plpgsql
as $$
declare
  booking_prefix text;
  next_seq integer;
begin
  booking_prefix := 'BK' || to_char(current_date, 'YYYYMMDD') || '-';

  select coalesce(
    max(
      case
        when booking_no like booking_prefix || '%' then right(booking_no, 4)::integer
        else 0
      end
    ),
    0
  ) + 1
  into next_seq
  from public.bookings
  where booking_no like booking_prefix || '%';

  return booking_prefix || lpad(next_seq::text, 4, '0');
end;
$$;
