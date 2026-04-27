import { requireRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  await requireRole(['owner', 'admin']);
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id,business_id,name,status,usage_minutes,monthly_limit_minutes')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <pre className="mt-4 rounded border bg-white p-3 text-xs">{JSON.stringify(businesses, null, 2)}</pre>
    </main>
  );
}
