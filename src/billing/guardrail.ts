/**
 * Billing guardrail: auto-disable AI when invoice unpaid or usage quota exceeded.
 * Otherwise you deliver free service forever.
 * Check before accepting calls and/or run sync from cron.
 */

export type BillingStatus = 'active' | 'unpaid' | 'over_quota' | 'suspended';

export interface BusinessBillingState {
  business_id: string;
  ai_enabled: boolean;
  billing_status: BillingStatus;
  usage_quota_minutes: number | null;
  usage_quota_calls: number | null;
  /** Current period usage minutes (from usage_metering) */
  usage_minutes: number;
  /** Current period calls count (from usage_metering) */
  calls_count: number;
}

/**
 * Returns true if AI should be allowed for this business; false if should be disabled.
 * Disable when: billing_status !== 'active', or over quota (if quota set).
 */
export function shouldAllowAI(state: BusinessBillingState): boolean {
  if (!state.ai_enabled) return false;
  if (state.billing_status !== 'active') return false;
  if (state.usage_quota_minutes != null && state.usage_minutes >= state.usage_quota_minutes) return false;
  if (state.usage_quota_calls != null && state.calls_count >= state.usage_quota_calls) return false;
  return true;
}

/**
 * Compute effective ai_enabled for guardrail: false when unpaid or over quota.
 * Call this (or run syncAiEnabledFromBilling) so business.ai_enabled is set to false
 * when invoice unpaid or usage quota exceeded.
 */
export function effectiveAiEnabled(state: BusinessBillingState): boolean {
  return shouldAllowAI(state);
}
