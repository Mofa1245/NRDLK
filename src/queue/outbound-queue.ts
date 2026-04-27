/**
 * Failure retry queue: WhatsApp send fails → enqueue; retry every 5 minutes.
 * Standard SaaS messaging architecture.
 */

import type { ConversationOutput } from '../schemas/conversation-output.js';

export type OutboundStatus = 'pending' | 'sent' | 'failed';

export interface OutboundQueueItem {
  id: string;
  business_id: string;
  to_phone: string;
  message: string;
  payload_json: ConversationOutput | null;
  status: OutboundStatus;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
  next_retry_at: string | null;
  sent_at: string | null;
}

export interface EnqueueParams {
  business_id: string;
  to_phone: string;
  message: string;
  payload_json?: ConversationOutput;
  last_error?: string;
}

export interface OutboundQueueStore {
  enqueue(params: EnqueueParams): Promise<string>;
  getPending(limit?: number): Promise<OutboundQueueItem[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getNextRetrySeconds(): number;
}

/** Retry interval in seconds (5 minutes) */
export const OUTBOUND_RETRY_INTERVAL_SECONDS = 5 * 60;

export const DEFAULT_MAX_RETRIES = 10;

/**
 * In-memory queue for tests; production should use Supabase/Postgres.
 */
export class InMemoryOutboundQueue implements OutboundQueueStore {
  private items: Array<OutboundQueueItem & { id: string }> = [];
  private idSeq = 0;

  getNextRetrySeconds(): number {
    return OUTBOUND_RETRY_INTERVAL_SECONDS;
  }

  async enqueue(params: EnqueueParams): Promise<string> {
    const id = `mem-${++this.idSeq}`;
    const nextRetry = new Date(Date.now() + OUTBOUND_RETRY_INTERVAL_SECONDS * 1000).toISOString();
    this.items.push({
      id,
      business_id: params.business_id,
      to_phone: params.to_phone,
      message: params.message,
      payload_json: params.payload_json ?? null,
      status: 'pending',
      retry_count: 0,
      max_retries: DEFAULT_MAX_RETRIES,
      last_error: params.last_error ?? null,
      created_at: new Date().toISOString(),
      next_retry_at: nextRetry,
      sent_at: null,
    });
    return id;
  }

  async getPending(limit = 50): Promise<OutboundQueueItem[]> {
    const now = new Date().toISOString();
    return this.items
      .filter((i) => i.status === 'pending' && (i.next_retry_at ?? '') <= now && i.retry_count < i.max_retries)
      .slice(0, limit)
      .map((i) => ({ ...i }));
  }

  async markSent(id: string): Promise<void> {
    const i = this.items.find((x) => x.id === id);
    if (i) {
      i.status = 'sent';
      i.sent_at = new Date().toISOString();
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const i = this.items.find((x) => x.id === id);
    if (i) {
      i.retry_count += 1;
      i.last_error = error;
      i.next_retry_at = new Date(Date.now() + OUTBOUND_RETRY_INTERVAL_SECONDS * 1000).toISOString();
      if (i.retry_count >= i.max_retries) i.status = 'failed';
    }
  }

  /** Test only: return all items with status pending (ignore next_retry_at). */
  getAllPendingForTest(): OutboundQueueItem[] {
    return this.items.filter((i) => i.status === 'pending').map((i) => ({ ...i }));
  }
}

/**
 * Supabase outbound_queue table. Requires env and @supabase/supabase-js.
 */
export async function createSupabaseOutboundQueue(): Promise<OutboundQueueStore> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const { createClient } = await import('@supabase/supabase-js').catch(() => {
    throw new Error('Install @supabase/supabase-js to use createSupabaseOutboundQueue');
  });
  const supabase = createClient(url, key);

  return {
    getNextRetrySeconds: () => OUTBOUND_RETRY_INTERVAL_SECONDS,

    async enqueue(params: EnqueueParams): Promise<string> {
      const nextRetry = new Date(Date.now() + OUTBOUND_RETRY_INTERVAL_SECONDS * 1000).toISOString();
      const { data, error } = await supabase
        .from('outbound_queue')
        .insert({
          business_id: params.business_id,
          to_phone: params.to_phone,
          message: params.message,
          payload_json: params.payload_json ?? null,
          status: 'pending',
          retry_count: 0,
          max_retries: DEFAULT_MAX_RETRIES,
          last_error: params.last_error ?? null,
          next_retry_at: nextRetry,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },

    async getPending(limit = 50): Promise<OutboundQueueItem[]> {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('outbound_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', now)
        .limit(limit * 2)
        .order('next_retry_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows
        .filter((r) => (r.retry_count as number) < (r.max_retries as number))
        .slice(0, limit)
        .map((r) => ({
          id: r.id as string,
          business_id: r.business_id as string,
          to_phone: r.to_phone as string,
          message: r.message as string,
          payload_json: r.payload_json as ConversationOutput | null,
          status: r.status as OutboundStatus,
          retry_count: r.retry_count as number,
          max_retries: r.max_retries as number,
          last_error: r.last_error as string | null,
          created_at: r.created_at as string,
          next_retry_at: r.next_retry_at as string | null,
          sent_at: r.sent_at as string | null,
        }));
    },

    async markSent(id: string): Promise<void> {
      const { error } = await supabase
        .from('outbound_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    async markFailed(id: string, error: string): Promise<void> {
      const { data: row } = await supabase.from('outbound_queue').select('retry_count, max_retries').eq('id', id).single();
      const retryCount = ((row as { retry_count: number })?.retry_count ?? 0) + 1;
      const maxRetries = (row as { max_retries: number })?.max_retries ?? DEFAULT_MAX_RETRIES;
      const nextRetry = new Date(Date.now() + OUTBOUND_RETRY_INTERVAL_SECONDS * 1000).toISOString();
      const { error: err } = await supabase
        .from('outbound_queue')
        .update({
          retry_count: retryCount,
          last_error: error,
          next_retry_at: nextRetry,
          status: retryCount >= maxRetries ? 'failed' : 'pending',
        })
        .eq('id', id);
      if (err) throw err;
    },
  };
}
