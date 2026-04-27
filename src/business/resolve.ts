import { getSupabase } from '../db/supabase.js';

export type ResolvedBusiness = {
  id: string;
  business_id: string;
  name: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  plan: string;
  status: string;
  monthly_limit_minutes: number;
  usage_minutes: number;
};

function normalize(phone: string) {
  let s = phone.replace('whatsapp:', '').replace(/\s+/g, '').trim();
  if (s.toLowerCase().startsWith('tel:')) s = s.slice(4);
  return s;
}

export async function resolveBusinessByPhone(phone: string): Promise<ResolvedBusiness | null> {
  const supabase = await getSupabase();
  const normalized = normalize(phone || '');
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('businesses')
    .select(
      'id,business_id,name,phone_number,whatsapp_number,plan,status,monthly_limit_minutes,usage_minutes',
    )
    .limit(200);

  if (error) {
    console.error('[RESOLVE] Supabase error — check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY:', error.message);
    return null;
  }
  if (!data?.length) {
    console.warn('[RESOLVE] No rows in businesses (empty table or wrong project).');
    return null;
  }
  const matched = data.find((row) => {
    const dbPhone = normalize(row.phone_number || '');
    const dbWhatsapp = normalize(row.whatsapp_number || '');
    return dbPhone === normalized || dbWhatsapp === normalized;
  });
  if (!matched) {
    console.warn(
      '[RESOLVE] No match. Twilio dialled number (normalized):',
      normalized || '(empty)',
      '— Set businesses.phone_number (or whatsapp_number) to EXACTLY that value (E.164 with +).',
    );
    return null;
  }
  return {
    id: matched.id,
    business_id: matched.business_id,
    name: matched.name,
    phone_number: matched.phone_number ?? null,
    whatsapp_number: matched.whatsapp_number ?? null,
    plan: matched.plan ?? 'basic',
    status: matched.status ?? 'active',
    monthly_limit_minutes: Number(matched.monthly_limit_minutes ?? 0),
    usage_minutes: Number(matched.usage_minutes ?? 0),
  };
}
