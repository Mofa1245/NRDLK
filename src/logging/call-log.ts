/**
 * Call transcript logging: call_id, business_id, timestamp, transcript,
 * llm_output_json, confidence, flagged, duration_seconds.
 * + recording_url (raw audio proof), prompt_version, model_version, config_version.
 * Store in Postgres / Supabase for dispute resolution, debugging, client trust.
 * Retention: delete or anonymize recording_url after retention_days (run via cron).
 */

import type { ConversationOutput } from '../schemas/conversation-output.js';

/** Default retention for recording URLs (days); after this, purge or anonymize for legal/GDPR. */
export const DEFAULT_RECORDING_RETENTION_DAYS = 90;

export interface CallLogRecord {
  call_id: string;
  business_id: string;
  timestamp: string; // ISO
  transcript: string;
  llm_output_json: ConversationOutput | null;
  confidence: number | null;
  flagged: boolean;
  high_priority: boolean;
  duration_seconds: number | null;
  caller_phone?: string;
  fallback_reason?: string;
  /** Twilio/Retell recording URL — transcript ≠ proof; raw audio for disputes/legal */
  recording_url?: string;
  /** Prompt version at call time; when something breaks, you know why */
  prompt_version?: string;
  /** Model version at call time */
  model_version?: string;
  /** Business config_version at call time; prevents "AI used old menu" disputes */
  config_version?: number;
}

export interface CallLogStore {
  insert(record: CallLogRecord): Promise<void>;
}

/**
 * In-memory store for tests; replace with Supabase/Postgres in production.
 */
export class InMemoryCallLogStore implements CallLogStore {
  private logs: CallLogRecord[] = [];

  async insert(record: CallLogRecord): Promise<void> {
    this.logs.push(record);
  }

  getAll(): CallLogRecord[] {
    return [...this.logs];
  }
}

/**
 * Supabase call log store. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Install @supabase/supabase-js when using this.
 */
export async function createSupabaseCallLogStore(): Promise<CallLogStore> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = await import('@supabase/supabase-js').catch(() => {
    throw new Error('Install @supabase/supabase-js to use createSupabaseCallLogStore');
  });
  const supabase = createClient(url, key);

  return {
    async insert(record: CallLogRecord): Promise<void> {
      const { error } = await supabase.from('call_logs').insert({
        call_id: record.call_id,
        business_id: record.business_id,
        timestamp: record.timestamp,
        transcript: record.transcript,
        llm_output_json: record.llm_output_json,
        confidence: record.confidence,
        flagged: record.flagged,
        high_priority: record.high_priority,
        duration_seconds: record.duration_seconds,
        caller_phone: record.caller_phone ?? null,
        fallback_reason: record.fallback_reason ?? null,
        recording_url: record.recording_url ?? null,
        prompt_version: record.prompt_version ?? null,
        model_version: record.model_version ?? null,
        config_version: record.config_version ?? null,
      });
      if (error) throw error;
    },
  };
}

export function buildCallLogRecord(params: {
  call_id: string;
  business_id: string;
  transcript: string;
  llm_output_json: ConversationOutput | null;
  flagged: boolean;
  high_priority: boolean;
  duration_seconds?: number;
  caller_phone?: string;
  fallback_reason?: string;
  recording_url?: string;
  prompt_version?: string;
  model_version?: string;
  config_version?: number;
}): CallLogRecord {
  return {
    call_id: params.call_id,
    business_id: params.business_id,
    timestamp: new Date().toISOString(),
    transcript: params.transcript,
    llm_output_json: params.llm_output_json,
    confidence: params.llm_output_json?.confidence ?? null,
    flagged: params.flagged,
    high_priority: params.high_priority,
    duration_seconds: params.duration_seconds ?? null,
    caller_phone: params.caller_phone,
    fallback_reason: params.fallback_reason,
    recording_url: params.recording_url,
    prompt_version: params.prompt_version,
    model_version: params.model_version,
    config_version: params.config_version,
  };
}
