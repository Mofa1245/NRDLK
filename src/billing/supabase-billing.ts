/**
 * Supabase-backed usage metering and billing guardrail sync.
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and migrations 004.
 */

import type { UsageMeteringStore, UsageMeteringRecord } from './usage-metering.js';
import { formatBillingPeriod, periodBounds } from './usage-metering.js';
import type { BusinessBillingState } from './guardrail.js';
import { effectiveAiEnabled } from './guardrail.js';

async function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  const { createClient } = await import('@supabase/supabase-js').catch(() => {
    throw new Error('Install @supabase/supabase-js for Supabase billing');
  });
  return createClient(url, key);
}

/**
 * Create usage metering store that reads/writes usage_metering table.
 */
async function getOrCreateImpl(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  business_id: string,
  period: { billing_period: string; period_start: string; period_end: string }
): Promise<UsageMeteringRecord> {
  const { data: existing } = await supabase
    .from('usage_metering')
    .select('*')
    .eq('business_id', business_id)
    .eq('billing_period', period.billing_period)
    .single();
  if (existing) {
    return {
      business_id: existing.business_id,
      billing_period: existing.billing_period,
      period_start: existing.period_start,
      period_end: existing.period_end,
      usage_minutes: Number(existing.usage_minutes ?? 0),
      calls_count: Number(existing.calls_count ?? 0),
    };
  }
  const { data: inserted, error } = await supabase
    .from('usage_metering')
    .insert({
      business_id,
      billing_period: period.billing_period,
      period_start: period.period_start,
      period_end: period.period_end,
      usage_minutes: 0,
      calls_count: 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    business_id: inserted.business_id,
    billing_period: inserted.billing_period,
    period_start: inserted.period_start,
    period_end: inserted.period_end,
    usage_minutes: Number(inserted.usage_minutes ?? 0),
    calls_count: Number(inserted.calls_count ?? 0),
  };
}

export async function createSupabaseUsageMetering(): Promise<UsageMeteringStore> {
  const supabase = await getSupabase();
  return {
    async getOrCreate(business_id, period) {
      return getOrCreateImpl(supabase, business_id, period);
    },

    async recordCall(business_id: string, billing_period: string, duration_seconds: number) {
      const { period_start, period_end } = periodBounds(billing_period);
      const row = await getOrCreateImpl(supabase, business_id, { billing_period, period_start, period_end });
      const newMinutes = row.usage_minutes + duration_seconds / 60;
      const newCalls = row.calls_count + 1;
      const { error } = await supabase
        .from('usage_metering')
        .update({
          usage_minutes: newMinutes,
          calls_count: newCalls,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', business_id)
        .eq('billing_period', billing_period);
      if (error) throw error;
    },
  };
}

/**
 * Load billing state for a business (for guardrail check).
 */
export async function getBusinessBillingState(business_id: string): Promise<BusinessBillingState | null> {
  const supabase = await getSupabase();
  const { data: biz } = await supabase
    .from('businesses')
    .select('business_id, ai_enabled, billing_status, usage_quota_minutes, usage_quota_calls')
    .eq('business_id', business_id)
    .single();
  if (!biz) return null;
  const period = formatBillingPeriod(new Date());
  const { period_start, period_end } = periodBounds(period);
  const store = await createSupabaseUsageMetering();
  const usage = await store.getOrCreate(business_id, { billing_period: period, period_start, period_end });
  return {
    business_id: biz.business_id,
    ai_enabled: Boolean(biz.ai_enabled),
    billing_status: (biz.billing_status as BusinessBillingState['billing_status']) ?? 'active',
    usage_quota_minutes: biz.usage_quota_minutes ?? null,
    usage_quota_calls: biz.usage_quota_calls ?? null,
    usage_minutes: usage.usage_minutes,
    calls_count: usage.calls_count,
  };
}

/**
 * Billing guardrail: set business.ai_enabled = false when invoice unpaid or usage quota exceeded.
 * Call from cron (e.g. daily) or before accepting each call.
 */
export async function syncAiEnabledFromBilling(business_id: string): Promise<boolean> {
  const state = await getBusinessBillingState(business_id);
  if (!state) return false;
  const shouldEnable = effectiveAiEnabled(state);
  const supabase = await getSupabase();
  const { data: biz } = await supabase.from('businesses').select('id, ai_enabled').eq('business_id', business_id).single();
  if (!biz || (biz as { ai_enabled: boolean }).ai_enabled === shouldEnable) return shouldEnable;
  await supabase.from('businesses').update({ ai_enabled: shouldEnable, updated_at: new Date().toISOString() }).eq('id', (biz as { id: string }).id);
  return shouldEnable;
}

/**
 * Sync all businesses (e.g. from cron).
 */
export async function syncAllAiEnabledFromBilling(): Promise<{ business_id: string; ai_enabled: boolean }[]> {
  const supabase = await getSupabase();
  const { data: businesses } = await supabase.from('businesses').select('business_id');
  const results: { business_id: string; ai_enabled: boolean }[] = [];
  for (const b of businesses ?? []) {
    const enabled = await syncAiEnabledFromBilling(b.business_id);
    results.push({ business_id: b.business_id, ai_enabled: enabled });
  }
  return results;
}
