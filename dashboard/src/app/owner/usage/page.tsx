import { requireRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export default async function OwnerUsagePage() {
  await requireRole(['owner']);
  const supabase = await createClient();
  const { data: usage } = await supabase
    .from('usage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Owner - Usage</h1>
      <pre className="mt-4 rounded border bg-white p-3 text-xs">{JSON.stringify(usage, null, 2)}</pre>
    </main>
  );
}
