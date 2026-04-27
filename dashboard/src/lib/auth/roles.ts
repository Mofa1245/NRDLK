import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireRole(allowed: Array<'owner' | 'admin' | 'client'>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleRow } = await supabase
    .from('users')
    .select('role,business_id')
    .eq('email', user.email ?? '')
    .limit(1)
    .maybeSingle();

  const role = (roleRow?.role as 'owner' | 'admin' | 'client' | undefined) ?? 'client';
  if (!allowed.includes(role)) {
    redirect('/dashboard');
  }

  return { user, role, businessRowId: roleRow?.business_id as string | null };
}
