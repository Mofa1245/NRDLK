import { getSupabase } from '../db/supabase.js';
import type { ResolvedBusiness } from './resolve.js';
import { sendWhatsApp } from '../whatsapp/send.js';
import { sendAlert } from '../alerts/alerts.js';

export async function enforceUsage(business: ResolvedBusiness) {
  if (process.env.DEMO_MODE === '1') return 'OK';
  const limit = Math.max(1, business.monthly_limit_minutes || 1);
  const usageRatio = business.usage_minutes / limit;
  if (usageRatio >= 1.2) return 'HARD_LIMIT';
  if (usageRatio >= 1.0) return 'DEGRADED';
  if (usageRatio >= 0.8) return 'WARNING';
  return 'OK';
}

export async function incrementUsage(
  business_id: string,
  duration: number,
  mode: 'fallback' | 'realtime',
) {
  const supabase = await getSupabase();
  const minutes = Math.max(1, Math.ceil(duration / 60));

  await supabase.from('usage_logs').insert({
    business_id,
    minutes_used: minutes,
    mode,
  });

  const { data: current } = await supabase
    .from('businesses')
    .select('usage_minutes')
    .eq('business_id', business_id)
    .limit(1)
    .maybeSingle();

  const next = Number(current?.usage_minutes ?? 0) + minutes;
  await supabase
    .from('businesses')
    .update({ usage_minutes: next, updated_at: new Date().toISOString() })
    .eq('business_id', business_id);
}

export async function sendUsageLimitWarning(to?: string) {
  if (!to) return;
  await sendWhatsApp('تنبيه: تم تجاوز الحد الشهري للاستخدام.', to);
}

export async function handleUsageStateAlerts(
  usageState: 'OK' | 'WARNING' | 'DEGRADED' | 'HARD_LIMIT',
  business: ResolvedBusiness,
) {
  if (usageState === 'WARNING') {
    await sendAlert(`[USAGE] warning ${business.business_id} ${business.usage_minutes}/${business.monthly_limit_minutes}`);
  } else if (usageState === 'HARD_LIMIT') {
    await sendAlert(`[USAGE] hard_limit ${business.business_id} ${business.usage_minutes}/${business.monthly_limit_minutes}`);
  }
}
