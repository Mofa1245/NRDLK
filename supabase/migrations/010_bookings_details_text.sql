alter table public.bookings
  add column if not exists details_text text;
