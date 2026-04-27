/**
 * Runtime safety guard: enforce at call start (before call handling).
 * Call this where calls enter the pipeline (e.g. Twilio/Retell webhook).
 */

import { shouldAllowAI } from '../billing/guardrail.js';
import { getBusinessBillingState } from '../billing/supabase-billing.js';
import { isOverRateLimit, recordCallStart } from './rate-limits.js';

export const AI_DISABLED_BY_BILLING = 'AI_DISABLED_BY_BILLING';
export const RATE_LIMIT_BLOCKED = 'RATE_LIMIT_BLOCKED';

/**
 * Throws if AI is not allowed for this business (billing, config, or quota).
 * Call at call start before handling the call.
 */
export async function assertAiAllowed(business_id: string): Promise<void> {
  const state = await getBusinessBillingState(business_id);
  if (!state) {
    throw new Error(AI_DISABLED_BY_BILLING);
  }
  if (!shouldAllowAI(state)) {
    throw new Error(AI_DISABLED_BY_BILLING);
  }
}

/**
 * Rate limit check at call start: throw if over limit, then record call.
 * Call immediately when the call is accepted.
 */
export function guardRateLimit(callerPhone: string): void {
  if (isOverRateLimit(callerPhone)) {
    throw new Error(RATE_LIMIT_BLOCKED);
  }
  recordCallStart(callerPhone);
}

/**
 * Full call-start guard: rate limit first, then billing/AI allowed.
 * Use in your call start handler: await guardCallStart(business_id, callerPhone);
 */
export async function guardCallStart(business_id: string, callerPhone: string): Promise<void> {
  if (isOverRateLimit(callerPhone)) {
    throw new Error(RATE_LIMIT_BLOCKED);
  }
  recordCallStart(callerPhone);
  await assertAiAllowed(business_id);
}
