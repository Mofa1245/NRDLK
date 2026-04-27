/**
 * Rate limits & abuse guard:
 * - per-number call frequency limit
 * - silence timeout cutoff (handled by voice stack; we define config)
 * - max call length (handled by voice stack; we define config)
 */

export interface RateLimitConfig {
  /** Max calls from the same number in this window */
  maxCallsPerNumber: number;
  /** Time window in seconds (e.g. 3600 = 1 hour) */
  windowSeconds: number;
  /** Max call duration in seconds; voice stack should end call when exceeded */
  maxCallLengthSeconds: number;
  /** Silence timeout in seconds; voice stack should end or prompt after this */
  silenceTimeoutSeconds: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxCallsPerNumber: 10,
  windowSeconds: 3600,
  maxCallLengthSeconds: 600, // 10 min
  silenceTimeoutSeconds: 15,
};

/** In-memory store for per-number call counts. Use Redis or DB in production. */
const callCountByNumber = new Map<string, { count: number; windowStart: number }>();

/**
 * Check if a caller number is over the rate limit. Call this at call start.
 * Returns true if the call should be rejected (abuse/over limit).
 */
export function isOverRateLimit(
  callerPhone: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const key = normalizePhone(callerPhone);
  const entry = callCountByNumber.get(key);

  if (!entry) return false;

  if (now - entry.windowStart >= config.windowSeconds) {
    callCountByNumber.delete(key);
    return false;
  }
  return entry.count >= config.maxCallsPerNumber;
}

/**
 * Record a call start for the given number. Call after accepting the call.
 */
export function recordCallStart(callerPhone: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG): void {
  const now = Math.floor(Date.now() / 1000);
  const key = normalizePhone(callerPhone);
  const entry = callCountByNumber.get(key);

  if (!entry || now - entry.windowStart >= config.windowSeconds) {
    callCountByNumber.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-12) || 'unknown';
}

/**
 * Check if call duration or silence should end the call (for voice stack to enforce).
 */
export function shouldEndCallByTime(
  callStartTime: number,
  lastActivityTime: number,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): { maxLengthExceeded: boolean; silenceExceeded: boolean } {
  const now = Date.now() / 1000;
  return {
    maxLengthExceeded: now - callStartTime >= config.maxCallLengthSeconds,
    silenceExceeded: now - lastActivityTime >= config.silenceTimeoutSeconds,
  };
}
