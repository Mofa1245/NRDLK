/**
 * Orchestrator: wires config → system prompt → voice flow → JSON parse → WhatsApp.
 * Use this from your voice stack (Twilio, Retell, etc.): pass config, get system prompt;
 * on call end, pass raw LLM output and optional WhatsApp sender.
 */

import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { BusinessConfig } from '../config/types.js';
import {
  parseConversationJson,
  type ConversationOutput,
} from '../schemas/conversation-output.js';
import {
  buildWhatsAppMessage,
  type WhatsAppPayload,
  type WhatsAppSender,
} from '../whatsapp/sender.js';
import {
  createInitialState,
  getNextPhase,
  type VoiceFlowPhase,
  type VoiceFlowState,
} from '../flow/voice-flow.js';
import {
  buildCallLogRecord,
  type CallLogStore,
} from '../logging/call-log.js';
import type { OutboundQueueStore } from '../queue/outbound-queue.js';
import { isHumanFallback } from '../schemas/conversation-output.js';
import type { UsageMeteringStore } from '../billing/usage-metering.js';
import { formatBillingPeriod } from '../billing/usage-metering.js';

export interface AgentContext {
  config: BusinessConfig;
  systemPrompt: string;
  flowState: VoiceFlowState;
  /** For call_logs: when something breaks, you know which prompt was used */
  promptVersion?: string;
  /** For call_logs: model version at call time */
  modelVersion?: string;
}

/**
 * Create agent context: load config and build system prompt for the voice model.
 */
export function createAgentContext(
  config: BusinessConfig,
  options?: { promptVersion?: string; modelVersion?: string }
): AgentContext {
  return {
    config,
    systemPrompt: buildSystemPrompt(config),
    flowState: createInitialState(),
    promptVersion: options?.promptVersion,
    modelVersion: options?.modelVersion,
  };
}

/**
 * Advance flow phase (call from your voice stack after each step).
 */
export function advancePhase(state: VoiceFlowState, phase: VoiceFlowPhase): VoiceFlowState {
  const next = getNextPhase(state.phase);
  if (next) {
    return { ...state, phase: next };
  }
  return state;
}

/**
 * On conversation end: parse LLM JSON, build WhatsApp payload, optionally send, and log call.
 * Returns parsed output, flagged, high_priority, and sent.
 */
export async function onConversationEnd(
  rawLlmOutput: string,
  context: AgentContext,
  options: {
    call_id: string;
    business_id: string;
    recipientPhone: string;
    transcript: string;
    duration_seconds?: number;
    recording_url?: string;
    whatsappSender?: WhatsAppSender;
    callLogStore?: CallLogStore;
    outboundQueue?: OutboundQueueStore;
    usageMeteringStore?: UsageMeteringStore;
  }
): Promise<{ output: ConversationOutput | null; flagged: boolean; high_priority: boolean; sent: boolean }> {
  const output = parseConversationJson(rawLlmOutput);
  if (!output) {
    return { output: null, flagged: false, high_priority: false, sent: false };
  }

  const built = buildWhatsAppMessage(output, {
    businessName: context.config.BUSINESS_NAME,
    confirmationRequired: context.config.WHATSAPP_CONFIRMATION_REQUIRED,
    useTemplates: context.config.useWhatsAppTemplates,
  });

  const payload: WhatsAppPayload = {
    to: options.recipientPhone,
    message: built.text,
    flagged: built.flagged,
    high_priority: built.high_priority,
    payload: output,
    templateName: built.templateName,
    templateParams: built.templateParams,
  };

  const flagged = built.flagged;
  const high_priority = built.high_priority;
  let sent = false;
  if (options.whatsappSender && context.config.WHATSAPP_CONFIRMATION_REQUIRED) {
    try {
      await options.whatsappSender.send(payload);
      sent = true;
    } catch (err) {
      if (options.outboundQueue) {
        await options.outboundQueue.enqueue({
          business_id: options.business_id,
          to_phone: options.recipientPhone,
          message: built.text,
          payload_json: output,
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }

  if (options.callLogStore) {
    const record = buildCallLogRecord({
      call_id: options.call_id,
      business_id: options.business_id,
      transcript: options.transcript,
      llm_output_json: output,
      flagged,
      high_priority: high_priority || isHumanFallback(output),
      duration_seconds: options.duration_seconds,
      caller_phone: options.recipientPhone,
      fallback_reason: output.fallback_reason ?? undefined,
      recording_url: options.recording_url,
      prompt_version: context.promptVersion,
      model_version: context.modelVersion,
      config_version: context.config.config_version ?? undefined,
    });
    await options.callLogStore.insert(record);
  }

  if (options.usageMeteringStore && options.duration_seconds != null) {
    try {
      await options.usageMeteringStore.recordCall(
        options.business_id,
        formatBillingPeriod(new Date()),
        options.duration_seconds
      );
    } catch {
      // do not fail the flow if metering fails
    }
  }

  return {
    output,
    flagged,
    high_priority,
    sent,
  };
}
