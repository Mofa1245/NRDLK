/**
 * Usage metering: usage_minutes, calls_count, billing_period.
 * Track even if you don't bill by usage yet — future you will be grateful.
 */

export interface UsageMeteringRecord {
  business_id: string;
  billing_period: string;
  period_start: string; // ISO date
  period_end: string;
  usage_minutes: number;
  calls_count: number;
}

export interface UsageMeteringStore {
  /** Get or create row for business + period; return current usage */
  getOrCreate(business_id: string, period: { billing_period: string; period_start: string; period_end: string }): Promise<UsageMeteringRecord>;
  /** Add a completed call: duration_seconds and +1 call */
  recordCall(business_id: string, billing_period: string, duration_seconds: number): Promise<void>;
}

/**
 * Format billing period e.g. "2025-02" for monthly, or "2025-W06" for weekly.
 */
export function formatBillingPeriod(date: Date, period: 'month' | 'week' = 'month'): string {
  if (period === 'week') {
    const y = date.getFullYear();
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const weekNum = Math.ceil(start.getDate() / 7) || 1;
    return `${y}-W${String(weekNum).padStart(2, '0')}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Period start/end for a billing period string "YYYY-MM".
 */
export function periodBounds(billing_period: string): { period_start: string; period_end: string } {
  const [y, m] = billing_period.split('-').map(Number);
  if (!m) {
    const d = new Date();
    return {
      period_start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10),
      period_end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10),
    };
  }
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  };
}
