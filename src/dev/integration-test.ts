/**
 * Integration test: full pipeline from LLM JSON → WhatsApp send, call log, outbound queue, usage metering.
 * Run: npm run integration:test
 */

import { onConversationEnd, createAgentContext } from '../agent/orchestrator.js';
import type { BusinessConfig } from '../config/types.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import { InMemoryOutboundQueue } from '../queue/outbound-queue.js';
import { InMemoryCallLogStore } from '../logging/call-log.js';
import type { UsageMeteringStore } from '../billing/usage-metering.js';
import type { WhatsAppSender } from '../whatsapp/sender.js';

const minimalConfig: BusinessConfig = {
  ...DEFAULT_CONFIG,
  BUSINESS_NAME: 'Test Business',
  BUSINESS_TYPE: 'Restaurant',
  BUSINESS_LANGUAGE_MODE: 'english',
  BUSINESS_HOURS: '9-21',
  SERVICES_OR_MENU: 'Table booking',
  BOOKING_RULES: 'Call to book',
  LOCATION_AREA: 'Doha',
  WHATSAPP_CONFIRMATION_REQUIRED: true,
  MAX_BOOKING_DAYS_AHEAD: 14,
} as BusinessConfig;

const context = createAgentContext(minimalConfig, {
  promptVersion: 'v1',
  modelVersion: 'gpt-standard',
});

const rawLlmOutput = JSON.stringify({
  intent: 'booking',
  customer_name: 'Ahmed',
  phone: '+123456789',
  service_or_items: 'Table for 2 at 7pm',
  time_requested: '7pm',
  location_details: '',
  notes: '',
  confidence: 0.9,
});

const fakeWhatsAppSender: WhatsAppSender = {
  async send(payload) {
    console.log('WA SEND OK:', {
      to: payload.to,
      messagePreview: payload.message.slice(0, 60) + '...',
      flagged: payload.flagged,
      high_priority: payload.high_priority,
    });
  },
};

const fakeUsageMeteringStore: UsageMeteringStore = {
  async getOrCreate() {
    return {
      business_id: 'test-biz',
      billing_period: '2025-02',
      period_start: '2025-02-01',
      period_end: '2025-02-28',
      usage_minutes: 0,
      calls_count: 0,
    };
  },
  async recordCall(business_id: string, billing_period: string, duration_seconds: number) {
    console.log('USAGE RECORDED:', { business_id, billing_period, duration_seconds });
  },
};

async function runIntegrationTest() {
  const queue = new InMemoryOutboundQueue();
  const callLogStore = new InMemoryCallLogStore();

  const result = await onConversationEnd(rawLlmOutput, context, {
    business_id: 'test-biz',
    call_id: 'test-call-1',
    recipientPhone: '+123456789',
    transcript: 'Customer booked a table for 2 at 7pm',
    duration_seconds: 180,
    recording_url: 'https://recordings.test/audio.mp3',
    whatsappSender: fakeWhatsAppSender,
    outboundQueue: queue,
    usageMeteringStore: fakeUsageMeteringStore,
    callLogStore,
  });

  console.log('Result:', { sent: result.sent, flagged: result.flagged, high_priority: result.high_priority });
  console.log('Call logs stored:', callLogStore.getAll().length);

  if (!result.output || result.output.intent !== 'booking') {
    throw new Error('Expected parsed output with intent=booking');
  }
  if (!result.sent) {
    throw new Error('Expected WhatsApp send to succeed');
  }

  console.log('✅ Integration test completed');
}

async function runFailureTest() {
  const queue = new InMemoryOutboundQueue();
  const failingSender: WhatsAppSender = {
    async send() {
      throw new Error('WhatsApp API down');
    },
  };

  await onConversationEnd(rawLlmOutput, context, {
    business_id: 'test-biz',
    call_id: 'test-call-fail',
    recipientPhone: '+123456789',
    transcript: 'Test',
    whatsappSender: failingSender,
    outboundQueue: queue,
  }).then(
    () => { throw new Error('Expected onConversationEnd to throw'); },
    (err) => {
      console.log('Expected error:', err.message);
      const pending = queue.getAllPendingForTest();
      if (pending.length !== 1) throw new Error('Expected 1 item in outbound queue, got ' + pending.length);
      console.log('✅ Failure test: item enqueued for retry');
    }
  );
}

async function main() {
  console.log('--- Happy path ---');
  await runIntegrationTest();
  console.log('\n--- WhatsApp fail → enqueue ---');
  await runFailureTest();
  console.log('\n✅ All integration tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
