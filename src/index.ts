/**
 * Qatar Business AI Phone Agent
 *
 * Export system prompt builder, flow, schemas, and orchestrator for use with
 * hosted voice stacks (Twilio, Retell, etc.). No custom ASR or model training.
 */

export { buildSystemPrompt } from './prompts/system-prompt.js';
export type { BusinessConfig, BusinessLanguageMode } from './config/types.js';
export { DEFAULT_CONFIG } from './config/types.js';
export type { ConversationOutput, CallerIntent } from './schemas/conversation-output.js';
export {
  parseConversationJson,
  isLowConfidence,
  CONFIDENCE_THRESHOLD_FLAG,
} from './schemas/conversation-output.js';
export type { VoiceFlowPhase, VoiceFlowState } from './flow/voice-flow.js';
export {
  createInitialState,
  getNextPhase,
  FLOW_PHASES,
} from './flow/voice-flow.js';
export type { WhatsAppPayload, WhatsAppSender } from './whatsapp/sender.js';
export { buildWhatsAppMessage } from './whatsapp/sender.js';
export {
  BOOKING_TEMPLATE_V1,
  ORDER_TEMPLATE_V1,
  URGENT_CALLBACK_TEMPLATE_V1,
  getTemplateName,
  getTemplateParams,
  getTemplateBodyForLog,
} from './whatsapp/templates.js';
export type { TemplateMessageSpec, TemplateComponent } from './whatsapp/templates.js';
export type { AgentContext } from './agent/orchestrator.js';
export {
  createAgentContext,
  advancePhase,
  onConversationEnd,
} from './agent/orchestrator.js';
export type { CallLogRecord, CallLogStore } from './logging/call-log.js';
export {
  buildCallLogRecord,
  InMemoryCallLogStore,
  createSupabaseCallLogStore,
  DEFAULT_RECORDING_RETENTION_DAYS,
} from './logging/call-log.js';
export type { RateLimitConfig } from './guards/rate-limits.js';
export {
  DEFAULT_RATE_LIMIT_CONFIG,
  isOverRateLimit,
  recordCallStart,
  shouldEndCallByTime,
} from './guards/rate-limits.js';
export {
  assertAiAllowed,
  guardRateLimit,
  guardCallStart,
  AI_DISABLED_BY_BILLING,
  RATE_LIMIT_BLOCKED,
} from './guards/call-start.js';
export type { MenuConfig, MenuItem } from './menu/parser.js';
export {
  parseMenuConfig,
  normalizeToMenuItems,
  buildMenuPromptSnippet,
  legacyMenuFromText,
} from './menu/parser.js';
export { isHumanFallback, CONFIDENCE_THRESHOLD_HUMAN_FALLBACK } from './schemas/conversation-output.js';
export type { FallbackReason } from './schemas/conversation-output.js';
export type { OutboundQueueStore, OutboundQueueItem, EnqueueParams } from './queue/outbound-queue.js';
export {
  InMemoryOutboundQueue,
  createSupabaseOutboundQueue,
  OUTBOUND_RETRY_INTERVAL_SECONDS,
  DEFAULT_MAX_RETRIES,
} from './queue/outbound-queue.js';
export { processOutboundQueue, startRetryWorker } from './queue/retry-worker.js';
export type { RetryWorkerOptions } from './queue/retry-worker.js';
export { checkPipeline, runHealthCheck, startHealthMonitor } from './health/monitor.js';
export type { HealthCheckResult, HealthMonitorOptions } from './health/monitor.js';
export { shouldAllowAI, effectiveAiEnabled } from './billing/guardrail.js';
export type { BusinessBillingState, BillingStatus } from './billing/guardrail.js';
export type { UsageMeteringStore, UsageMeteringRecord } from './billing/usage-metering.js';
export { formatBillingPeriod, periodBounds } from './billing/usage-metering.js';
export {
  createSupabaseUsageMetering,
  getBusinessBillingState,
  syncAiEnabledFromBilling,
  syncAllAiEnabledFromBilling,
} from './billing/supabase-billing.js';
