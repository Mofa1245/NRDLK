/**
 * Telnyx recording-complete webhook: when recording ends, run pipeline.
 * POST /telnyx/recording-complete — connect to your pipeline (STT → LLM later).
 */

import { Router } from 'express';
import { createAgentContext, onConversationEnd } from '../agent/orchestrator.js';
import type { BusinessConfig } from '../config/types.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import { InMemoryCallLogStore } from '../logging/call-log.js';
import { InMemoryOutboundQueue } from '../queue/outbound-queue.js';

const router = Router();

const testBusinessConfig: BusinessConfig = {
  ...DEFAULT_CONFIG,
  BUSINESS_NAME: 'Test Business',
  BUSINESS_TYPE: 'Restaurant',
  BUSINESS_LANGUAGE_MODE: 'english',
  BUSINESS_HOURS: '9-21',
  SERVICES_OR_MENU: 'Table booking',
  BOOKING_RULES: 'Call to book',
  LOCATION_AREA: 'Doha',
  WHATSAPP_CONFIRMATION_REQUIRED: false,
  MAX_BOOKING_DAYS_AHEAD: 14,
} as BusinessConfig;

router.post('/recording-complete', async (req, res) => {
  const payload = req.body?.data?.payload ?? req.body?.payload ?? req.body;

  const callId = payload?.call_leg_id ?? payload?.call_control_id ?? 'unknown';
  const recordingUrl =
    payload?.recording_urls?.mp3 ?? payload?.recording_url ?? payload?.recording_urls?.wav ?? '';
  const from = payload?.from ?? payload?.to ?? 'unknown';
  const duration = payload?.duration_secs ?? payload?.duration_seconds ?? 0;

  console.log('[CALL END]', JSON.stringify({ callId, recordingUrl, from }));

  const context = createAgentContext(testBusinessConfig, {
    promptVersion: 'v1',
    modelVersion: 'telnyx-voice-v1',
  });

  const fakeTranscript = 'Test transcript placeholder';

  const fakeLlmJson = JSON.stringify({
    intent: 'booking',
    customer_name: 'Test',
    phone: from,
    service_or_items: '',
    time_requested: '',
    location_details: '',
    notes: '',
    confidence: 0.8,
  });

  await onConversationEnd(fakeLlmJson, context, {
    call_id: callId,
    business_id: 'test-biz',
    transcript: fakeTranscript,
    duration_seconds: duration || 120,
    recording_url: recordingUrl || undefined,
    recipientPhone: from,
    callLogStore: new InMemoryCallLogStore(),
    outboundQueue: new InMemoryOutboundQueue(),
  });

  res.sendStatus(200);
});

export default router;
