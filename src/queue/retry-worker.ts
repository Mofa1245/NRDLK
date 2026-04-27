/**
 * Retry worker: every 5 minutes, process outbound_queue pending items and send via WhatsApp.
 * Run as a cron job or long-running process.
 */

import type { OutboundQueueStore } from './outbound-queue.js';
import type { WhatsAppSender } from '../whatsapp/sender.js';
import type { ConversationOutput } from '../schemas/conversation-output.js';
import { isLowConfidence, isHumanFallback } from '../schemas/conversation-output.js';

export interface RetryWorkerOptions {
  queue: OutboundQueueStore;
  whatsappSender: WhatsAppSender;
  /** Interval in ms (default 5 min) */
  intervalMs?: number;
  onError?: (itemId: string, error: unknown) => void;
}

/**
 * Process pending queue items once (send WhatsApp, mark sent or failed).
 */
export async function processOutboundQueue(
  queue: OutboundQueueStore,
  whatsappSender: WhatsAppSender
): Promise<{ sent: number; failed: number }> {
  const pending = await queue.getPending(50);
  let sent = 0;
  let failed = 0;
  for (const item of pending) {
    const payload = (item.payload_json ?? {}) as ConversationOutput;
    try {
      await whatsappSender.send({
        to: item.to_phone,
        message: item.message,
        flagged: payload.confidence != null ? isLowConfidence(payload) : false,
        high_priority: payload.confidence != null ? isHumanFallback(payload) : false,
        payload,
      });
      await queue.markSent(item.id);
      sent++;
    } catch (err) {
      await queue.markFailed(item.id, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * Run retry worker in a loop (every 5 minutes). For cron, use processOutboundQueue once per run.
 */
export function startRetryWorker(options: RetryWorkerOptions): () => void {
  const intervalMs = options.intervalMs ?? options.queue.getNextRetrySeconds() * 1000;
  const run = async () => {
    try {
      await processOutboundQueue(options.queue, options.whatsappSender);
    } catch (err) {
      options.onError?.('worker', err);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}
