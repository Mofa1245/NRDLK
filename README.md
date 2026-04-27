# Qatar Business AI Phone Agent

Professional AI phone receptionist for businesses in Qatar: answer missed calls, capture intent (booking / order / inquiry), and create structured records with optional WhatsApp confirmation.

## Features

- **Dynamic system prompt** — Business name, type, hours, services/menu, booking rules, location, and language mode (Arabic / bilingual / English) injected from config.
- **Voice flow** — `on_call_start` → greet → intent_detect → slot_fill → confirm_summary → emit_json → send_to_whatsapp → end_call.
- **Structured output** — At conversation end the model emits only JSON: intent, customer_name, phone, service_or_items, time_requested, location_details, notes, confidence.
- **Confidence scoring** — Self-score 1.0 / 0.7 / 0.4 / 0.2; scores below 0.7 are **flagged** in the WhatsApp message for business review.
- **Qatari dialect** — Optional booster block for Gulf Arabic when language mode is Arabic or bilingual.
- **Error-safety** — No card numbers, no medical/legal advice, always identify as automated if asked.
- **Call transcript logging** — `call_id`, `business_id`, `timestamp`, `transcript`, `llm_output_json`, `confidence`, `flagged`, `high_priority`, `duration_seconds`, **`recording_url`** (Twilio/Retell raw audio), **`prompt_version`**, **`model_version`**, **`config_version`** stored in Postgres/Supabase. Transcript ≠ proof; keep recording URL for disputes and legal. Retention: purge or anonymize after `DEFAULT_RECORDING_RETENTION_DAYS` (e.g. cron).
- **Human fallback** — If confidence &lt; 0.4, caller says "human", or 2 clarification failures → "I will mark this for urgent callback" and **HIGH PRIORITY** WhatsApp.
- **Rate limits & abuse guard** — Per-number call frequency limit, silence timeout, max call length (configurable).
- **Menu/service parser** — Optional `menu_items[]` with `synonyms[]` (e.g. shawarma → شاورما → wrap) for better recognition.
- **Business dashboard** — Next.js + Supabase: sign in, change hours, toggle AI on/off, see today's calls, download logs (CSV). When business saves settings, **config_version** is incremented and attached to each call log (prevents “AI used old menu” disputes).
- **Prompt/model version tracking** — Store `prompt_version` and `model_version` on each call log; when something breaks, you know why.
- **Outbound retry queue** — WhatsApp send fails → enqueue to `outbound_queue`; retry every 5 minutes (status: pending/sent/failed, retry_count). Run `processOutboundQueue` or `startRetryWorker` in cron or long-running process.
- **Health monitor** — Cron every 5 min: `npm run health` or `runHealthCheck({ healthUrl, onFailure })`. Verifies pipeline (or GET health URL); on failure alert via webhook/email. Otherwise you won’t know the system is down.
- **Terms + consent (voice)** — Opening greeting includes: *"This call is handled by an automated system and may be recorded for quality purposes."* (in system prompt). Protects you legally in most jurisdictions.
- **WhatsApp template lock** — In production do **not** send free-form messages. Use pre-approved templates only: `BOOKING_TEMPLATE_V1`, `ORDER_TEMPLATE_V1`, `URGENT_CALLBACK_TEMPLATE_V1`. Set `config.useWhatsAppTemplates: true`; payload then includes `templateName` + `templateParams` for WhatsApp Business API.
- **Billing guardrail** — Set `business.ai_enabled = false` when invoice unpaid or usage quota exceeded. Use `getBusinessBillingState`, `shouldAllowAI`, `syncAiEnabledFromBilling` (or cron `syncAllAiEnabledFromBilling`). Otherwise you deliver free service forever.
- **Usage metering** — Table `usage_metering`: `usage_minutes`, `calls_count`, `billing_period`. Track even if you don’t bill yet. Pass `usageMeteringStore` to `onConversationEnd` to record each call; use `createSupabaseUsageMetering()`.

## Variables (pass in code / config)

| Variable | Description |
|----------|-------------|
| `BUSINESS_NAME` | Business name |
| `BUSINESS_TYPE` | e.g. Salon, Restaurant |
| `BUSINESS_LANGUAGE_MODE` | `arabic` \| `bilingual` \| `english` |
| `BUSINESS_HOURS` | Working hours text |
| `SERVICES_OR_MENU` | Services or menu items |
| `BOOKING_RULES` | Booking/cancellation rules |
| `LOCATION_AREA` | Area/location description |
| `WHATSAPP_CONFIRMATION_REQUIRED` | Send summary to WhatsApp (default `true`) |
| `MAX_BOOKING_DAYS_AHEAD` | Max days for booking (default 14) |
| `useWhatsAppTemplates` | Use locked templates only in production (no free-form WhatsApp) |

## Quick start

```bash
npm install
npm run build
```

Build system prompt from example config:

```bash
node dist/cli/build-prompt.js config/example-business.json
```

Run integration test (orchestration pipeline: LLM JSON → WhatsApp, call log, usage metering; and failure → outbound queue):

```bash
npm run integration:test
```

Run smoke test (prompt build + JSON parse only):

```bash
npm run smoke:test
```

**Call start guard** — In your call start handler (where calls enter the pipeline), enforce before handling:

```ts
import { guardCallStart, AI_DISABLED_BY_BILLING, RATE_LIMIT_BLOCKED } from 'qatar-business-ai-phone';

await guardCallStart(business_id, callerPhone);
// If this throws: RATE_LIMIT_BLOCKED or AI_DISABLED_BY_BILLING — reject/redirect the call.
```

Use in your voice stack (Twilio, Retell, etc.):

```ts
import {
  createAgentContext,
  onConversationEnd,
  type BusinessConfig,
} from 'qatar-business-ai-phone';
import { consoleWhatsAppSender } from './whatsapp/console-sender.js';

const config: BusinessConfig = { /* from JSON or env */ };
const context = createAgentContext(config, {
  promptVersion: 'v1.2',   // for call_logs
  modelVersion: 'gpt-4o', // for call_logs
});

// 1. Use context.systemPrompt as the system message for your voice LLM.
// 2. (Optional) At call start: check rate limit, record call.
// import { isOverRateLimit, recordCallStart } from 'qatar-business-ai-phone';

// 3. On call end, when the model returns the final JSON:
const result = await onConversationEnd(
  rawLlmOutput,
  context,
  {
    call_id: 'twilio-xyz',
    business_id: 'al-rayyan-salon',
    recipientPhone: '+974...',
    transcript: '...',
    duration_seconds: 120,
    recording_url: 'https://api.twilio.com/.../Recordings/RE...', // or Retell link
    whatsappSender: consoleWhatsAppSender,
    callLogStore: await createSupabaseCallLogStore(),
    outboundQueue: await createSupabaseOutboundQueue(), // on send failure → retry every 5 min
  }
);
// result.output, result.flagged, result.high_priority, result.sent
```

## Cost (hosted stacks)

Typical production voice (AI + voice processing): **~$0.03–$0.08 per minute** (e.g. Twilio, Retell). Restaurants at 40–90 min/month = very low infra cost per client.

Do **not** train custom models or host GPUs for a startup; prompt + flow + confirmation loop is enough for production reliability.

## Dashboard (Next.js + Supabase)

Minimal business panel: sign in, change hours, toggle AI, see today's calls, download logs.

```bash
cd dashboard
cp .env.example .env.local   # set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install && npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Run Supabase migrations in the SQL editor (`supabase/migrations/*.sql`), then create a business and link it to a user in `businesses` and `business_users`. Saving hours/AI toggle increments **config_version** (stored with each call).

## Telnyx Voice Setup

Voice transport uses **Telnyx** programmable voice webhooks. The same AI pipeline, billing, guards, logging, and queue are unchanged; only the transport layer is Telnyx.

### 1. Run your voice server

```bash
npm run voice:start
```

Server runs on port 3000 (or `PORT` env).

### 2. Environment variables

In project root `.env` (or shell):

- **TELNYX_WEBHOOK_BASE_URL** — Base URL for webhooks (e.g. your ngrok HTTPS URL or production domain). Used for the recording callback. Example: `https://your-domain.com` (no trailing slash).
- **TELNYX_SKIP_BILLING_GUARD=1** — Optional; skip billing/Supabase check for local testing (rate limit still applies).

### 3. Buy and configure Telnyx number

- Buy a Telnyx phone number in [Telnyx Portal](https://portal.telnyx.com).
- Set **inbound webhook** for the number:
  - **URL:** `POST https://YOUR_DOMAIN/telnyx/voice`
  - Use your public URL (ngrok or production).

Telnyx will POST call events to your server. When recording ends, Telnyx will POST to:

- **Recording complete:** `POST https://YOUR_DOMAIN/telnyx/recording-complete`

Ensure your server is reachable at `TELNYX_WEBHOOK_BASE_URL` so the recording callback URL is correct.

### 4. Test a call

Call your Telnyx number. You should hear the greeting and consent line, then recording. After the call ends, the recording-complete webhook runs and the pipeline executes (with placeholder transcript and LLM output until STT/LLM are wired).

## Twilio Voice (primary testing transport)

Twilio is available **in addition to** Telnyx. The same pipeline runs; only the webhook path differs.

### Environment

The voice server loads **`.env` in the project root**, then **`dashboard/.env`** (only keys not already set in root).

- **TWILIO_WEBHOOK_BASE_URL** — Base URL (e.g. ngrok HTTPS) with no trailing slash. Used for `recordingStatusCallback` so Twilio can reach `/twilio/recording-complete`.
- **TWILIO_SKIP_BILLING_GUARD=1** — Optional; skip billing guard for local testing (rate limit still applies).
- **TWILIO_ACCOUNT_SID** / **TWILIO_AUTH_TOKEN** — **Required** to download recordings from `api.twilio.com` (HTTP Basic Auth — [Twilio Console](https://console.twilio.com/) → API keys & tokens). Without these you get **401** on fetch.
- **Local STT (Whisper):** `pip install -r scripts/requirements.txt`, install [ffmpeg](https://ffmpeg.org/download.html) on your PATH, optional **PYTHON_PATH** if `python` is not on PATH. `/twilio/recording-complete` runs **`scripts/transcribe.py`** (Whisper `base` model).
- **ENABLE_REALTIME_STREAM=1** — Optional; enables Twilio `<Connect><Stream>` realtime mode. Default is off (recording fallback).
- **REALTIME_SERVER_URL** — Required only in realtime mode; host/domain for `wss://<host>/media-stream` (no `https://` prefix).
- **OPENAI_REALTIME_MODEL** — Optional realtime model override (default `gpt-4o-mini-realtime-preview`).

### Configure Twilio number

In Twilio Console → Phone Numbers → your number → Voice:

- **A call comes in:** Webhook **POST** `https://YOUR_DOMAIN/twilio/voice`
- **Content type:** `application/x-www-form-urlencoded`

Recording status callback is built from `TWILIO_WEBHOOK_BASE_URL` + `/twilio/recording-complete`.

If realtime mode is enabled (`ENABLE_REALTIME_STREAM=1`), the Twilio voice webhook returns stream TwiML and uses `/media-stream` websocket upgrades on the same `voice:start` server.

## Operation modes (single source of truth)

Use only one mode at a time to avoid confusion:

- **Fallback mode (recommended default):**
  - `ENABLE_REALTIME_STREAM` unset (or `0`)
  - Call flow: record -> local Whisper -> AI parse -> WhatsApp confirmation
  - Best when realtime model access is unavailable.
- **Realtime mode (premium voice):**
  - `ENABLE_REALTIME_STREAM=1`
  - Requires realtime model access in your OpenAI project
  - Call flow: Twilio media stream -> OpenAI Realtime -> audio back to caller
  - If realtime fails, disable this flag to return to stable fallback mode.

### Minimal runbook

- Start server: `npm run voice:start`
- Start tunnel: `ngrok http 3000`
- Twilio "A call comes in": `https://YOUR_NGROK_DOMAIN/twilio/voice`
- Keep `TWILIO_WEBHOOK_BASE_URL=https://YOUR_NGROK_DOMAIN`

## Health cron (every 5 min)

```bash
# Pipeline check; exit 1 on failure for alerting
HEALTH_ALERT_WEBHOOK=https://hooks.slack.com/... npm run health

# Or hit your voice webhook first
HEALTH_URL=https://your-app.com/health npm run health
```

## License

MIT
