import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get first business linked to this user (business_users.business_id = businesses.id uuid)
  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const businessRowId = businessUser?.business_id ?? null;
  let business: {
    id: string;
    business_id: string;
    name: string;
    business_hours: string;
    ai_enabled: boolean;
    config_version: number;
    status: string;
    plan: string;
    usage_minutes: number;
    monthly_limit_minutes: number;
    whatsapp_number: string | null;
    phone_number: string | null;
  } | null = null;
  if (businessRowId) {
    const { data: b } = await supabase
      .from('businesses')
      .select('id, business_id, name, business_hours, ai_enabled, config_version,status,plan,usage_minutes,monthly_limit_minutes,whatsapp_number,phone_number')
      .eq('id', businessRowId)
      .single();
    business = b;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: calls } = await supabase
    .from('call_logs')
    .select('*')
    .eq('business_id', business?.business_id ?? '')
    .gte('timestamp', `${today}T00:00:00Z`)
    .lte('timestamp', `${today}T23:59:59Z`)
    .order('timestamp', { ascending: false });

  const { data: usageLogs } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('business_id', business?.business_id ?? '')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', business?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <DashboardClient
        userEmail={user.email ?? ''}
        business={business}
        usageLogs={(usageLogs ?? []) as any[]}
        messages={(messages ?? []) as any[]}
        todayCalls={(calls ?? []) as Array<{
          id: string;
          call_id: string;
          timestamp: string;
          confidence: number | null;
          flagged: boolean;
          high_priority: boolean;
          duration_seconds: number | null;
        }>}
      />
    </main>
  );
}
