/**
 * Telnyx voice webhook: call entry point.
 * Telnyx hits POST /telnyx/voice when a call comes in.
 */

import { Router } from 'express';
import {
  guardCallStart,
  guardRateLimit,
  AI_DISABLED_BY_BILLING,
  RATE_LIMIT_BLOCKED,
} from '../guards/call-start.js';

const router = Router();

router.post('/voice', async (req, res) => {
  const event = req.body?.data;
  const from = event?.payload?.from ?? 'unknown';
  const callControlId = event?.payload?.call_control_id;

  console.log('[CALL START]', JSON.stringify({ from, callControlId }));

  const business_id = 'test-biz';
  const skipBillingGuard = process.env.TELNYX_SKIP_BILLING_GUARD === '1';

  try {
    if (skipBillingGuard) {
      guardRateLimit(from);
    } else {
      await guardCallStart(business_id, from);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ERROR]', message);

    if (message === RATE_LIMIT_BLOCKED) {
      return res.json([
        { action: 'talk', text: 'Too many calls. Please try again later.' },
        { action: 'hangup' },
      ]);
    }
    if (message === AI_DISABLED_BY_BILLING) {
      return res.json([
        { action: 'talk', text: 'Service temporarily unavailable. Please call later.' },
        { action: 'hangup' },
      ]);
    }
    return res.json([
      { action: 'talk', text: 'System error. Please call later.' },
      { action: 'hangup' },
    ]);
  }

  const baseUrl = process.env.TELNYX_WEBHOOK_BASE_URL ?? '';
  const recordingCallback = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/telnyx/recording-complete`
    : '/telnyx/recording-complete';

  return res.json([
    {
      action: 'talk',
      text: 'Marhaba. This call is handled by an automated system and may be recorded for quality purposes.',
    },
    {
      action: 'record',
      direction: 'both',
      event_url: [recordingCallback],
    },
  ]);
});

export default router;
