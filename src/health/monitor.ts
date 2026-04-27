/**
 * Health monitor: every 5 minutes, verify pipeline (test call or pipeline check), alert if fail.
 * Run as cron: node dist/health/monitor.js
 * Or use checkPipeline() in your own cron.
 */

import { createAgentContext } from '../agent/orchestrator.js';
import { parseConversationJson } from '../schemas/conversation-output.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import type { BusinessConfig } from '../config/types.js';

export interface HealthCheckResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Verify core pipeline without a real call: build prompt, parse sample JSON.
 * For full "test call" use your voice stack (Twilio/Retell) to hit a test number.
 */
export function checkPipeline(sampleConfig?: Partial<BusinessConfig>): HealthCheckResult {
  const config: BusinessConfig = {
    ...DEFAULT_CONFIG,
    BUSINESS_NAME: sampleConfig?.BUSINESS_NAME ?? 'Health Check',
    BUSINESS_TYPE: sampleConfig?.BUSINESS_TYPE ?? 'Test',
    BUSINESS_LANGUAGE_MODE: sampleConfig?.BUSINESS_LANGUAGE_MODE ?? 'english',
    BUSINESS_HOURS: sampleConfig?.BUSINESS_HOURS ?? '9-5',
    SERVICES_OR_MENU: sampleConfig?.SERVICES_OR_MENU ?? 'Test',
    BOOKING_RULES: sampleConfig?.BOOKING_RULES ?? '',
    LOCATION_AREA: sampleConfig?.LOCATION_AREA ?? '',
    WHATSAPP_CONFIRMATION_REQUIRED: false,
    MAX_BOOKING_DAYS_AHEAD: 14,
  } as BusinessConfig;

  try {
    const context = createAgentContext(config, {
      promptVersion: 'health-1',
      modelVersion: 'test',
    });
    if (!context.systemPrompt || context.systemPrompt.length < 100) {
      return { ok: false, message: 'System prompt too short', details: { length: context.systemPrompt?.length } };
    }
    const sampleJson = JSON.stringify({
      intent: 'inquiry',
      customer_name: 'Test',
      phone: '+9740000',
      service_or_items: '',
      time_requested: '',
      location_details: '',
      notes: '',
      confidence: 1,
    });
    const parsed = parseConversationJson(sampleJson);
    if (!parsed || parsed.intent !== 'inquiry') {
      return { ok: false, message: 'Sample JSON parse failed', details: { parsed } };
    }
    return { ok: true, message: 'Pipeline OK', details: { promptLength: context.systemPrompt.length } };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      details: { stack: err instanceof Error ? err.stack : undefined },
    };
  }
}

export interface HealthMonitorOptions {
  /** Callback when check fails (e.g. send Slack/email/webhook) */
  onFailure?: (result: HealthCheckResult) => void | Promise<void>;
  /** Interval in ms (default 5 min) */
  intervalMs?: number;
  /** Optional HTTP URL to GET (e.g. voice webhook health); if 2xx, skip pipeline check */
  healthUrl?: string;
}

/**
 * Run health check every 5 minutes; on failure call onFailure (alert).
 */
export async function runHealthCheck(options: HealthMonitorOptions = {}): Promise<HealthCheckResult> {
  const { healthUrl, onFailure } = options;
  if (healthUrl) {
    try {
      const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(10000) });
      if (res.ok) return { ok: true, message: `Health URL OK ${res.status}` };
      const result: HealthCheckResult = { ok: false, message: `Health URL ${res.status}` };
      await onFailure?.(result);
      return result;
    } catch (err) {
      const result: HealthCheckResult = {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
      await onFailure?.(result);
      return result;
    }
  }
  const result = checkPipeline();
  if (!result.ok) await onFailure?.(result);
  return result;
}

/**
 * Loop: run health check every intervalMs (default 5 min). For cron, run runHealthCheck once.
 */
export function startHealthMonitor(options: HealthMonitorOptions): () => void {
  const intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  const run = () => runHealthCheck(options);
  run();
  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}
