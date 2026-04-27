/**
 * Twilio recording-complete webhook: when recording ends, run pipeline.
 * POST /twilio/recording-complete
 *
 * Transcription: local Whisper via scripts/transcribe.py (requires Python + ffmpeg).
 */

import fs from 'fs';
import path from 'path';
import { execFileSync, execSync, type ExecSyncOptions } from 'child_process';
import { Router } from 'express';
import { parseTranscript } from '../ai/parse.js';
import { enrichStructuredFromTranscript } from '../ai/heuristic-booking.js';
import { handlePostCall } from '../postcall/postcall.js';
import { resolveBusinessByPhone } from '../business/resolve.js';
import { enforceUsage, sendUsageLimitWarning, handleUsageStateAlerts } from '../business/usage.js';
import { createAgentContext, onConversationEnd } from '../agent/orchestrator.js';
import type { BusinessConfig } from '../config/types.js';
import { DEFAULT_CONFIG } from '../config/types.js';
import { InMemoryCallLogStore } from '../logging/call-log.js';
import { InMemoryOutboundQueue } from '../queue/outbound-queue.js';
import { resolvePythonAndArgs } from '../util/resolve-python.js';

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

/**
 * Twilio recording media on api.twilio.com requires HTTP Basic Auth:
 * Account SID + Auth Token (same as Twilio Console API credentials).
 */
async function fetchRecordingBuffer(recordingUrl: string): Promise<ArrayBuffer> {
  const isTwilioHost = recordingUrl.includes('api.twilio.com');
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (isTwilioHost && (!sid || !token)) {
    throw new Error(
      'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env or dashboard/.env — required to download recordings from api.twilio.com (401 without them).'
    );
  }

  const headers: Record<string, string> = {};
  if (sid && token) {
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
  }

  const audioResponse = await fetch(recordingUrl, { headers });
  if (!audioResponse.ok) {
    const hint =
      audioResponse.status === 401
        ? ' Invalid Twilio credentials or wrong account for this RecordingUrl.'
        : '';
    throw new Error(`Failed to fetch recording: ${audioResponse.status} ${audioResponse.statusText}${hint}`);
  }
  return audioResponse.arrayBuffer();
}

function extensionFromRecordingUrl(recordingUrl: string): string {
  try {
    const ext = path.extname(new URL(recordingUrl).pathname);
    return ext || '.wav';
  } catch {
    return '.wav';
  }
}

/** Whisper Python calls `ffmpeg` by name; ensure the same binary as Node (FFMPEG_PATH) is on PATH. */
function childEnvWithFfmpegPath(): NodeJS.ProcessEnv {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  const ffmpegPath = process.env.FFMPEG_PATH?.trim();
  if (ffmpegPath) {
    const dir = path.dirname(path.resolve(ffmpegPath));
    const sep = path.delimiter;
    env.PATH = `${dir}${sep}${env.PATH ?? ''}`;
  }
  return env;
}

function runLocalWhisperStrict(audioFilePath: string): string {
  const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');
  const { executable, args } = resolvePythonAndArgs(scriptPath, [audioFilePath]);
  const output = execFileSync(executable, args, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
    env: childEnvWithFfmpegPath(),
  });
  return output.toString().trim();
}

async function transcribeAudio(audioBuffer: ArrayBuffer, callSid: string, recordingUrl: string) {
  const tempDir = path.join(process.cwd(), 'temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const safeId = (callSid || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = extensionFromRecordingUrl(recordingUrl);
  const inputPath = path.join(tempDir, `${safeId}-input${ext}`);
  const outputPath = path.join(tempDir, `${safeId}-16k.wav`);

  fs.writeFileSync(inputPath, Buffer.from(audioBuffer));
  console.log('Saved file:', inputPath);
  console.log('File size:', fs.statSync(inputPath).size);
  if (fs.statSync(inputPath).size < 1000) {
    console.error('[STT DEBUG] input size < 1000 bytes — audio download may be broken');
  }

  const q = (p: string) => `"${p.replace(/"/g, '\\"')}"`;
  const ffmpegBin = (process.env.FFMPEG_PATH || 'ffmpeg').trim() || 'ffmpeg';
  const ffmpegOpts: ExecSyncOptions = {
    stdio: 'inherit',
    windowsHide: true,
  };
  try {
    execSync(`${q(ffmpegBin)} -y -i ${q(inputPath)} -ar 16000 -ac 1 ${q(outputPath)}`, ffmpegOpts);
  } catch (err) {
    const hint =
      'Install ffmpeg (e.g. winget install Gyan.FFmpeg) and ensure it is on PATH, ' +
      'or set FFMPEG_PATH to the full path of ffmpeg.exe (e.g. C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe).';
    throw new Error(`FFMPEG FAILED — ${hint} Underlying: ${String(err)}`);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('FFMPEG FAILED — output missing');
  }
  console.log('Converted file:', outputPath);
  console.log('Converted size:', fs.statSync(outputPath).size);
  if (fs.statSync(outputPath).size < 500) {
    console.error('[STT DEBUG] converted size very small — ffmpeg may have failed');
  }

  console.log('USING FILE:', outputPath);
  console.log('[WHISPER] bilingual auto-detect (Arabic / English / mixed)');

  const raw = runLocalWhisperStrict(outputPath);
  console.log('[MANUAL TEST RESULT]', raw);

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('STT FAILED — NO TEXT');
  }

  const keep = process.env.STT_KEEP_AUDIO_FILES === '1';
  if (!keep) {
    try {
      fs.unlinkSync(inputPath);
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // ignore
    }
  } else {
    console.log('[STT DEBUG] keeping audio files (STT_KEEP_AUDIO_FILES=1)');
  }

  return trimmed;
}

router.post('/recording-complete', async (req, res) => {
  console.log('[CALL END]', '/twilio/recording-complete');
  const callSid = req.body.CallSid as string;
  const recordingUrl = req.body.RecordingUrl as string;
  const from =
    (req.body.From as string) ||
    (req.body.Caller as string) ||
    (req.body.Called as string) ||
    'unknown';
  const duration = parseInt(String(req.body.RecordingDuration || '0'), 10);
  const toNumber = String(
    (req.body.To as string) || (req.body.Called as string) || '',
  ).trim();
  const selectedLang = String((req.query?.lang as string) || '').trim();

  console.log('[TWILIO IDS]', {
    To: req.body.To,
    Called: req.body.Called,
    From: req.body.From,
    dialledForResolve: toNumber || '(empty)',
  });

  const business = await resolveBusinessByPhone(toNumber);
  console.log('[BUSINESS]', business?.id || null);
  if (!business || business.status !== 'active') {
    await handlePostCall({
      callId: callSid,
      businessId: 'unresolved',
      from,
      transcript: 'Could not understand audio',
      structured: { intent: 'unknown', _lang: selectedLang || undefined },
      confidence: 0.1,
      duration: duration || 60,
      mode: 'fallback'
    });
    return res.status(200).send('inactive');
  }

  const usageState = await enforceUsage(business);
  await handleUsageStateAlerts(usageState, business);
  if (usageState === 'HARD_LIMIT') {
    await sendUsageLimitWarning(business.whatsapp_number || process.env.BUSINESS_WHATSAPP_NUMBER);
    await handlePostCall({
      callId: callSid,
      businessId: business.business_id,
      from,
      transcript: 'Could not understand audio',
      structured: { intent: 'unknown', _lang: selectedLang || undefined },
      confidence: 0.1,
      duration: duration || 60,
      mode: 'fallback'
    });
    return res.status(200).send('Limit reached');
  }

  let realTranscript = '';
  let structured: any = { intent: 'unknown' };

  try {
    const audioBuffer = await fetchRecordingBuffer(recordingUrl);
    realTranscript = await transcribeAudio(audioBuffer, callSid, recordingUrl);
    console.log('[RAW TRANSCRIPT]', realTranscript);
    structured = await parseTranscript(realTranscript, selectedLang === 'en' || selectedLang === 'ar' ? selectedLang : undefined);
    structured = enrichStructuredFromTranscript(realTranscript, structured as Record<string, unknown>) as typeof structured;
    if (selectedLang === 'ar' || selectedLang === 'en') {
      structured._lang = selectedLang;
    }
    console.log('[TRANSCRIPT]', realTranscript);
    console.log('[STRUCTURED]', structured);

    // Confidence logic (after heuristic enrich so slots matter)
    let confidence = Number(structured?.confidence ?? 1.0);
    if (!Number.isFinite(confidence)) confidence = 1.0;

    if (structured.time == null || structured.time === '') {
      confidence -= 0.3;
    }

    if (structured.number_of_people == null) {
      confidence -= 0.3;
    }

    if (structured.intent === 'unknown') {
      confidence -= 0.5;
    }

    confidence = Math.max(0.05, Math.min(1, confidence));
    if (
      structured._heuristic_enriched &&
      structured.intent === 'booking' &&
      structured.number_of_people != null &&
      structured.time != null &&
      String(structured.time).trim() !== '' &&
      structured._time_coarse !== true
    ) {
      confidence = Math.max(confidence, 0.72);
    }

    await handlePostCall({
      callId: callSid,
      businessId: business.business_id,
      from,
      transcript: realTranscript,
      structured,
      confidence,
      duration: duration || 120,
      mode: 'fallback'
    });

    const context = createAgentContext(testBusinessConfig, {
      promptVersion: 'v1',
      modelVersion: 'local-whisper-v1',
    });

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
      call_id: callSid,
      business_id: business.business_id,
      transcript: realTranscript,
      duration_seconds: duration || 120,
      recording_url: recordingUrl,
      recipientPhone: from,
      callLogStore: new InMemoryCallLogStore(),
      outboundQueue: new InMemoryOutboundQueue(),
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('[ERROR]', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isSttFailure =
      msg.includes('STT FAILED') ||
      msg.includes('FFMPEG FAILED') ||
      msg.includes('COMMAND_FAILED') ||
      msg.includes('ENOENT');
    if (isSttFailure) {
      console.error('[STT FAIL LOUD]', msg);
      res.status(500).type('text').send(`STT pipeline failed: ${msg}`);
      return;
    }
    await handlePostCall({
      callId: callSid,
      businessId: business.business_id,
      from,
      transcript: realTranscript.trim() || 'Could not understand audio',
      structured: {
        intent: 'unknown',
        _lang: selectedLang || undefined,
        ...(realTranscript.trim() ? { raw: realTranscript } : {}),
      },
      confidence: realTranscript.trim() ? 0.35 : 0.2,
      duration: duration || 60,
      mode: 'fallback'
    });
    res.status(200).send('safe');
  }
});

export default router;
