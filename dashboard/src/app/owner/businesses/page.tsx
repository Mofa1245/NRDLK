import Link from 'next/link';
import { requireRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export default async function OwnerBusinessesPage() {
  await requireRole(['owner']);
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id,business_id,name,plan,status,usage_minutes,monthly_limit_minutes')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Owner - Businesses</h1>
      <ul className="mt-4 space-y-2">
        {(businesses ?? []).map((b: any) => (
          <li key={b.id} className="rounded border bg-white p-3">
            <Link href={`/owner/business/${b.id}`} className="font-medium hover:underline">
              {b.name}
            </Link>
            <div className="text-sm text-stone-600">
              {b.business_id} | {b.plan} | {b.status} | {b.usage_minutes}/{b.monthly_limit_minutes} min
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
