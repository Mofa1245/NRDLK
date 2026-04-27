create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  call_id text,
  customer_phone text not null,
  booking_date date,
  booking_time text,
  party_size int,
  special_request text,
  language text,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'confirmed', 'handoff')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_business_id on public.bookings(business_id);
create index if not exists idx_bookings_created_at_desc on public.bookings(created_at desc);
