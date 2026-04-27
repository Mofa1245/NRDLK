alter table public.bookings
  add column if not exists corrected_by_customer boolean not null default false;
