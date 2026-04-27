alter table public.bookings
  add column if not exists updated_by_staff boolean not null default false;

alter table public.bookings
  add column if not exists original_booking jsonb;
