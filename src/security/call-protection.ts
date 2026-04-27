const callsByNumber = new Map<string, number[]>();
const blocked = new Set<string>();

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_MIN = 5;
const MAX_CALL_DURATION_SECONDS = 300;

export function evaluateCallProtection(from: string) {
  if (!from) return { ok: false, reason: 'BLOCKED' as const };
  if (blocked.has(from)) return { ok: false, reason: 'BLOCKED' as const };

  const now = Date.now();
  const current = (callsByNumber.get(from) || []).filter((t) => now - t < WINDOW_MS);
  current.push(now);
  callsByNumber.set(from, current);

  if (current.length > MAX_CALLS_PER_MIN) {
    blocked.add(from);
    return { ok: false, reason: 'RATE' as const };
  }

  return { ok: true as const };
}

export function getMaxCallDurationSeconds() {
  return MAX_CALL_DURATION_SECONDS;
}
