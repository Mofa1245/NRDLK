import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

const cwd = process.cwd();
loadDotenv({ path: resolve(cwd, '.env') });
loadDotenv({ path: resolve(cwd, '.env.production'), override: false });
loadDotenv({ path: resolve(cwd, 'dashboard', '.env'), override: false });

/**
 * Voice server: Telnyx + Twilio webhooks (same pipeline).
 * Run: npm run voice:start
 *
 * Env: loads `.env` in project root, then `dashboard/.env` (fills any keys missing from root).
 */

import express from 'express';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import { OpenAIRealtimeWebSocket } from 'openai/beta/realtime/websocket';
import { handlePostCall } from './postcall/postcall.js';
import { parseRealtimeTranscript } from './realtime/parse.js';
import { getSession, updateSession, clearSession, getSessionsCount } from './context/session.js';
import { resolveBusinessByPhone } from './business/resolve.js';
import { enforceUsage, sendUsageLimitWarning, handleUsageStateAlerts } from './business/usage.js';
import { getMaxCallDurationSeconds } from './security/call-protection.js';
import { trackErrorAlert } from './alerts/alerts.js';
import telnyxVoice from './telnyx/voice-webhook.js';
import telnyxRecording from './telnyx/recording-complete.js';
import twilioVoice from './twilio/voice-webhook.js';
import twilioRecording from './twilio/recording-complete.js';
import whatsappWebhook from './twilio/whatsapp-webhook.js';
import apiHealth from './api/health.js';
import apiBusiness from './api/business.js';
import apiBookings from './api/bookings.js';

const app = express();
const ENGINE_VERSION = (process.env.ENGINE_VERSION || 'v1').trim() || 'v1';

function envOk(value?: string) {
  return typeof value === 'string' && value.trim().length > 0;
}

function printReadyCheck() {
  const twilioOk =
    envOk(process.env.TWILIO_ACCOUNT_SID) &&
    envOk(process.env.TWILIO_AUTH_TOKEN) &&
    envOk(process.env.TWILIO_WEBHOOK_BASE_URL);
  const whatsappOk = envOk(process.env.TWILIO_WHATSAPP_FROM) || envOk(process.env.BUSINESS_WHATSAPP_NUMBER);
  const sttOk = envOk(process.env.PYTHON_PATH) || envOk(process.env.WHISPER_MODEL);
  const dbOk = envOk(process.env.SUPABASE_URL) && envOk(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const dashboardOk = envOk(process.env.NEXT_PUBLIC_API_URL) || envOk(process.env.NEXT_PUBLIC_BACKEND_URL);

  console.log('[READY CHECK]');
  console.log(`- Twilio: ${twilioOk ? 'OK' : 'MISSING_CONFIG'}`);
  console.log(`- WhatsApp: ${whatsappOk ? 'OK' : 'MISSING_CONFIG'}`);
  console.log(`- STT: ${sttOk ? 'OK' : 'MISSING_CONFIG'}`);
  console.log(`- DB: ${dbOk ? 'OK' : 'MISSING_CONFIG'}`);
  console.log(`- Dashboard: ${dashboardOk ? 'OK' : 'MISSING_CONFIG'}`);
}

if (!process.env.TWILIO_WEBHOOK_BASE_URL) throw new Error('Missing TWILIO_WEBHOOK_BASE_URL');
if (!process.env.TWILIO_ACCOUNT_SID) throw new Error('Missing TWILIO_ACCOUNT_SID');
if (!process.env.TWILIO_AUTH_TOKEN) throw new Error('Missing TWILIO_AUTH_TOKEN');

// OpenAI Realtime websocket client expects global WebSocket in Node.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/telnyx', telnyxVoice);
app.use('/telnyx', telnyxRecording);
app.use('/twilio', twilioVoice);
app.use('/twilio', twilioRecording);
app.use('/twilio', whatsappWebhook);
app.use('/api', apiHealth);
app.use('/api', apiBusiness);
app.use('/api', apiBookings);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', async (ws, req) => {
  console.log('[CALL START]', req.url);
  const callId = randomUUID();
  const startTime = Date.now();
  let from = 'unknown';
  let businessId = 'unknown-business';
  let sessionKey: string = callId;
  let postcallDone = false;
  updateSession(sessionKey, { transcript: '' });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[ERROR]', 'OPENAI_API_KEY missing');
    ws.close();
    return;
  }

  const openai = new OpenAI({ apiKey });
  const realtimeModel = process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-4o-mini-realtime-preview';
  const ai = await OpenAIRealtimeWebSocket.create(openai, {
    model: realtimeModel,
  }).catch((err) => {
    console.error('[ERROR]', err);
    return null;
  });

  if (!ai) {
    ws.close();
    return;
  }

  ai.on('error', (event: unknown) => {
    console.error('[ERROR]', event);
  });

  // Wait for underlying realtime websocket to be OPEN before sending events.
  const aiSocket = ai.socket as {
    readyState: number;
    addEventListener: (type: string, listener: () => void, options?: { once?: boolean }) => void;
  };
  if (aiSocket.readyState !== 1) {
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      aiSocket.addEventListener('open', finish, { once: true });
      aiSocket.addEventListener('error', finish, { once: true });
    });
  }
  if (aiSocket.readyState !== 1) {
    console.error('[ERROR]', 'Realtime socket did not open');
    ai.close();
    ws.close();
    return;
  }

  let streamSid = '';
  const pendingAudio: string[] = [];
  let firstAiAudioSent = false;
  let greeted = false;
  const realtimeTimeoutMs = Number.parseInt(process.env.REALTIME_FAILOVER_TIMEOUT_MS || '5000', 10);
  const responseTimeout = setTimeout(() => {
    if (!firstAiAudioSent) {
      console.error('[ERROR]', 'Realtime timeout: no AI audio within timeout window');
      try {
        ai.close();
      } catch {}
      try {
        ws.close();
      } catch {}
    }
  }, Number.isNaN(realtimeTimeoutMs) ? 5000 : realtimeTimeoutMs);

  try {
    ai.send({
      type: 'session.update',
      session: {
      instructions: `
You are a high-end restaurant receptionist in Qatar.

Rules:
- Speak Arabic naturally (Qatari dialect preferred)
- Use English if user speaks English
- Keep responses SHORT (1–2 sentences)
- Always guide conversation step-by-step
- Ask for missing info (people, time)
- Confirm before finishing
- Sound polite, premium, calm

Behavior:
- Do NOT give long explanations
- Do NOT repeat user input fully
- Be conversational, not robotic

Goal:
Complete booking efficiently and naturally.
`,
      turn_detection: {
        type: 'server_vad',
        silence_duration_ms: 400
      },
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw'
      }
    });
  } catch (e) {
    console.error('[ERROR]', e);
  }

  try {
    ai.send({
      type: 'response.create',
      response: {
      conversation: 'default',
      modalities: ['audio'],
      interruptible: true
      } as any
    });
  } catch (e) {
    console.error('[ERROR]', e);
  }

  if (!greeted) {
    greeted = true;
    try {
      ai.send({
        type: 'response.create',
        response: {
        modalities: ['audio'],
        instructions: 'ابدأ بالترحيب واسأل كيف تقدر تساعد.'
        }
      });
    } catch (e) {
      console.error('[ERROR]', e);
    }
  }

  ws.on('message', async (message) => {
    try {
      const raw = Array.isArray(message)
        ? Buffer.concat(message).toString('utf8')
        : message instanceof ArrayBuffer
          ? Buffer.from(new Uint8Array(message)).toString('utf8')
          : Buffer.from(message).toString('utf8');
      const data = JSON.parse(raw) as {
        event?: string;
        start?: { streamSid?: string; customParameters?: { from?: string } };
        media?: { payload?: string };
      };

      if (data.event === 'start') {
        streamSid = data.start?.streamSid ?? '';
        const candidateFrom = data.start?.customParameters?.from;
        if (candidateFrom) {
          from = candidateFrom;
          const resolvedBusiness = await resolveBusinessByPhone(candidateFrom).catch(() => null);
          if (!resolvedBusiness) {
            try {
              ws.close();
            } catch {}
            return;
          }
          businessId = resolvedBusiness.business_id;
          const usageState = await enforceUsage(resolvedBusiness);
          await handleUsageStateAlerts(usageState, resolvedBusiness);
          if (resolvedBusiness.status !== 'active' || usageState === 'HARD_LIMIT') {
            await sendUsageLimitWarning(
              resolvedBusiness.whatsapp_number || process.env.BUSINESS_WHATSAPP_NUMBER,
            );
            try {
              ws.close();
            } catch {}
            return;
          }
          if (usageState === 'DEGRADED') {
            try {
              ws.close();
            } catch {}
            return;
          }
          const existing = getSession(sessionKey);
          sessionKey = from;
          updateSession(sessionKey, {
            transcript: ((getSession(sessionKey).transcript || '') + (existing.transcript || '')).slice(-4000),
            structured: {
              ...(getSession(sessionKey).structured || {}),
              businessId
            },
            state: getSession(sessionKey).state || {}
          });
          if (sessionKey !== callId) {
            clearSession(callId);
          }
        }
      }

      if (data.event === 'media' && data.media?.payload) {
        if (aiSocket.readyState === 1) {
          try {
            ai.send({
              type: 'input_audio_buffer.append',
              audio: data.media.payload,
            });
          } catch (e) {
            console.error('[ERROR]', e);
          }
        } else {
          pendingAudio.push(data.media.payload);
        }
      }
    } catch (err) {
      console.error('[ERROR]', err);
    }
  });

  while (pendingAudio.length && aiSocket.readyState === 1) {
    const audio = pendingAudio.shift();
    if (!audio) break;
    try {
      ai.send({
        type: 'input_audio_buffer.append',
        audio,
      });
    } catch (e) {
      console.error('[ERROR]', e);
    }
  }

  ai.on('response.audio.delta', (event: { delta?: string }) => {
    if (!event.delta || !streamSid) return;
    firstAiAudioSent = true;

    try {
      ws.send(
        JSON.stringify({
          event: 'media',
          streamSid,
          media: {
            payload: event.delta,
          },
        }),
      );
    } catch (e) {
      console.error('[ERROR]', e);
    }
  });

  ai.on('response.audio_transcript.delta', (event: { delta?: string }) => {
    if (!event.delta) return;
    const session = getSession(sessionKey);
    updateSession(sessionKey, {
      transcript: ((session.transcript || '') + event.delta).slice(-4000)
    });
  });

  ws.on('close', () => {
    if (postcallDone) return;
    postcallDone = true;
    console.log('[CALL END]', callId);
    clearTimeout(responseTimeout);
    ai.close();
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const session = getSession(sessionKey);
    const transcriptBuffer = session.transcript || '';

    void (async () => {
      const parsed = await parseRealtimeTranscript(transcriptBuffer);

      await handlePostCall({
        callId,
        businessId,
        from,
        transcript: transcriptBuffer,
        structured: parsed,
        confidence: parsed.confidence,
        duration,
        mode: 'realtime'
      });
      clearSession(sessionKey);
      clearSession(from);
    })();
  });

  ws.on('error', (err) => {
    console.error('[ERROR]', err);
    clearTimeout(responseTimeout);
    try {
      ai.close();
    } catch {}
  });

  setTimeout(() => {
    try {
      ws.close();
    } catch {}
  }, getMaxCallDurationSeconds() * 1000);
});

server.on('upgrade', (req, socket, head) => {
  if (process.env.ENABLE_REALTIME_STREAM !== '1') {
    socket.destroy();
    return;
  }

  if (req.url?.startsWith('/media-stream')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT ?? 3000;
setInterval(() => {
  void getSessionsCount();
}, 60000);

try {
  server.listen(port, () => {
    console.log('[ENGINE VERSION]', ENGINE_VERSION);
    if (process.env.DEMO_MODE === '1') {
      console.log('[DEMO MODE] limits/billing/rate-blocking bypassed');
    }
    printReadyCheck();
    return;
  });
} catch (e) {
  console.error('[ERROR]', e);
  void trackErrorAlert('server-start');
}
