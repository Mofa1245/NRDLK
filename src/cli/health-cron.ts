#!/usr/bin/env node
/**
 * Health monitor cron: run every 5 min. Example crontab: every 5 min run node dist/cli/health-cron.js
 * Verifies pipeline; on failure logs and optionally exits non-zero for alerting.
 */

import { runHealthCheck } from '../health/monitor.js';

const healthUrl = process.env.HEALTH_URL; // optional: GET this URL first
const alertWebhook = process.env.HEALTH_ALERT_WEBHOOK; // optional: POST result on failure

async function main() {
  const result = await runHealthCheck({
    healthUrl: healthUrl || undefined,
    onFailure: async (r) => {
      console.error('[health] FAIL', r.message, r.details ?? '');
      if (alertWebhook) {
        try {
          await fetch(alertWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, message: r.message, details: r.details }),
          });
        } catch (e) {
          console.error('[health] Alert webhook failed', e);
        }
      }
    },
  });
  if (result.ok) {
    console.log('[health] OK', result.message);
    process.exit(0);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
