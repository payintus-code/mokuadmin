create index if not exists idx_bookings_end_at
  on public.bookings (end_at);

create index if not exists idx_bookings_time_range_gist
  on public.bookings using gist (tstzrange(start_at, end_at, '[)'));
