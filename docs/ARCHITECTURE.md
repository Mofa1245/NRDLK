# AI Phone System Architecture

This project runs in two modes with one Twilio entrypoint.

## 1) Primary flow (realtime, optional)

- Trigger: `ENABLE_REALTIME_STREAM=1`
- Twilio webhook: `POST /twilio/voice`
- TwiML response: `<Connect><Stream url="wss://<host>/media-stream" />`
- Transport: websocket upgrade on `/media-stream` in `src/server.ts`
- Runtime:
  - incoming Twilio media -> OpenAI Realtime input buffer
  - OpenAI audio deltas -> Twilio media outbound payload

If realtime model access is missing, disable realtime mode and use fallback mode below.

## 2) Fallback flow (default, stable)

- Trigger: `ENABLE_REALTIME_STREAM` unset or not `1`
- Twilio webhook: `POST /twilio/voice`
- TwiML response: greeting + `recordingStatusCallback` to `/twilio/recording-complete`
- Processing (`src/twilio/recording-complete.ts`):
  - download recording from Twilio
  - local Whisper transcription (`scripts/transcribe.py`)
  - AI parse (`src/ai/parse.ts`)
  - confidence + needs-confirmation logic
  - WhatsApp-style message generation/logging

## 3) Shared business rules

- Rate limiting and billing guards in `src/guards` and `src/billing`
- Structured pipeline + call logging via orchestrator (`src/agent/orchestrator.ts`)
- Queue/retry and health monitor remain unchanged.

## 4) Key files map

- `src/server.ts`: HTTP server + websocket upgrade + realtime bridge
- `src/twilio/voice-webhook.ts`: Twilio TwiML mode selection
- `src/twilio/recording-complete.ts`: fallback transcription/parse pipeline
- `src/ai/parse.ts`: structured extraction from transcript
- `src/whatsapp/sender.ts`: WhatsApp payload builder
- `README.md`: setup and env documentation

## 5) Minimal runbook

1. Start server: `npm run voice:start`
2. Start tunnel: `ngrok http 3000`
3. Twilio voice webhook URL: `https://<ngrok>/twilio/voice`
4. For fallback mode: keep realtime disabled.
5. For realtime mode: set `ENABLE_REALTIME_STREAM=1` and realtime model env values.
