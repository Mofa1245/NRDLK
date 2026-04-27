import { getSupabase } from '../db/supabase.js';

export async function getUserRole(email: string) {
  const supabase = await getSupabase();
  const { data } = await supabase.from('users').select('role').eq('email', email).limit(1).maybeSingle();
  return data?.role ?? 'client';
}

export async function requireRole(email: string, allowed: string[]) {
  const role = await getUserRole(email);
  return allowed.includes(role);
}
