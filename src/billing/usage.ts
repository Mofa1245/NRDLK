export function trackUsage({
  callId,
  businessId,
  mode,
  duration,
  outcome
}: {
  callId: string;
  businessId: string;
  mode: 'fallback' | 'realtime';
  duration: number;
  outcome: 'success' | 'handoff';
}) {
  const record = {
    callId,
    businessId,
    mode,
    duration,
    outcome,
    timestamp: new Date().toISOString()
  };

  console.log('[USAGE]', JSON.stringify(record));

  // future: persist to DB
}
