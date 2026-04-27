/**
 * Structured JSON emitted at conversation end (per system prompt).
 */
export type CallerIntent = 'booking' | 'order' | 'inquiry' | 'callback request' | 'other';

export type FallbackReason = 'low_confidence' | 'caller_asked_human' | 'clarification_failures' | '';

export interface ConversationOutput {
  intent: CallerIntent;
  customer_name: string;
  phone: string;
  service_or_items: string;
  time_requested: string;
  location_details: string;
  notes: string;
  confidence: number; // 0–1
  /** Set by LLM or server: triggers "I will mark this for urgent callback" + HIGH PRIORITY WhatsApp */
  high_priority?: boolean;
  /** Why human fallback was triggered */
  fallback_reason?: FallbackReason;
}

export const CONFIDENCE_THRESHOLD_FLAG = 0.7; // Below this → flagged WhatsApp for review
export const CONFIDENCE_THRESHOLD_HUMAN_FALLBACK = 0.4; // Below this → high priority / urgent callback

export function isLowConfidence(output: ConversationOutput): boolean {
  return output.confidence < CONFIDENCE_THRESHOLD_FLAG;
}

/** True when we should say "I will mark this for urgent callback" and send HIGH PRIORITY WhatsApp */
export function isHumanFallback(output: ConversationOutput): boolean {
  if (output.high_priority === true) return true;
  if (output.fallback_reason) return true;
  return output.confidence < CONFIDENCE_THRESHOLD_HUMAN_FALLBACK;
}

export function parseConversationJson(raw: string): ConversationOutput | null {
  try {
    const parsed = JSON.parse(raw) as ConversationOutput;
    if (
      typeof parsed.intent === 'string' &&
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      return {
        intent: parsed.intent,
        customer_name: String(parsed.customer_name ?? ''),
        phone: String(parsed.phone ?? ''),
        service_or_items: String(parsed.service_or_items ?? ''),
        time_requested: String(parsed.time_requested ?? ''),
        location_details: String(parsed.location_details ?? ''),
        notes: String(parsed.notes ?? ''),
        confidence: parsed.confidence,
        high_priority: Boolean(parsed.high_priority),
        fallback_reason: parsed.fallback_reason ?? '',
      };
    }
  } catch {
    // ignore
  }
  return null;
}
