with target_business as (
  select id as business_id
  from public.businesses
  order by created_at asc
  limit 1
)
insert into public.bookings (
  business_id,
  call_id,
  customer_phone,
  booking_date,
  booking_time,
  party_size,
  special_request,
  language,
  status,
  confirmed_at,
  corrected_by_customer
)
select
  tb.business_id,
  demo.call_id,
  demo.customer_phone,
  demo.booking_date,
  demo.booking_time,
  demo.party_size,
  demo.special_request,
  demo.language,
  'confirmed',
  now(),
  false
from target_business tb
cross join (
  values
    ('demo-call-001', '+97430000001', current_date, '7:00', 2, null, 'en'),
    ('demo-call-002', '+97430000002', current_date, '8:30', 4, 'birthday', 'en'),
    ('demo-call-003', '+97430000003', current_date, '6:45', 6, 'family seating', 'ar')
) as demo(call_id, customer_phone, booking_date, booking_time, party_size, special_request, language)
where not exists (
  select 1
  from public.bookings b
  where b.call_id = demo.call_id
);
