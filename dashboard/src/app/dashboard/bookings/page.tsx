import { createClient } from '@/lib/supabase/server';
import { getBackendApiBase } from '@/lib/backend-base';
import { redirect } from 'next/navigation';
import { BookingsClient } from './BookingsClient';

type Booking = {
  id: string;
  customer_phone: string;
  booking_date: string | null;
  booking_time: string | null;
  party_size: number | null;
  special_request: string | null;
  details_text: string | null;
  updated_by_staff: boolean;
  status: 'pending_confirmation' | 'confirmed' | 'handoff' | string;
  confirmed_at: string | null;
  corrected_by_customer: boolean;
  created_at: string;
};

export default async function DashboardBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const businessRowId = businessUser?.business_id ?? null;

  let businessIdText = '';
  if (businessRowId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('business_id')
      .eq('id', businessRowId)
      .maybeSingle();
    businessIdText = String((biz as any)?.business_id || '');
  }

  let bookings: Booking[] = [];
  if (businessIdText) {
    try {
      const base = getBackendApiBase() || (process.env.VERCEL ? '' : 'http://localhost:3000');
      if (!base) {
        console.error('[BOOKINGS_SSR] Set BACKEND_URL or NEXT_PUBLIC_API_URL on Vercel to your Railway API URL');
      } else {
        const url = `${base}/api/bookings?business_id=${encodeURIComponent(businessIdText)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { bookings?: Booking[] };
          bookings = (json.bookings || []) as Booking[];
        }
      }
    } catch (error) {
      console.error('[BOOKINGS_LOAD_FAILED]', error);
    }
  }

  return <BookingsClient initialBookings={bookings} businessIdText={businessIdText} />;
}
