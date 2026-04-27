import { requireRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { OwnerBusinessActions } from './OwnerBusinessActions';

export default async function OwnerBusinessDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['owner']);
  const supabase = await createClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('business_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Owner - Business Detail</h1>
      <pre className="mt-4 rounded border bg-white p-3 text-xs">{JSON.stringify(business, null, 2)}</pre>
      {business?.id ? <OwnerBusinessActions businessId={business.id} /> : null}
      <h2 className="mt-6 text-lg font-medium">Recent calls</h2>
      <pre className="mt-2 rounded border bg-white p-3 text-xs">{JSON.stringify(calls, null, 2)}</pre>
      <h2 className="mt-6 text-lg font-medium">Recent messages</h2>
      <pre className="mt-2 rounded border bg-white p-3 text-xs">{JSON.stringify(messages, null, 2)}</pre>
    </main>
  );
}
