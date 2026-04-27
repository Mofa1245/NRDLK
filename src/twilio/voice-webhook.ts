/**
 * Twilio voice webhook: primary testing transport; routes into the same pipeline as Telnyx.
 * POST /twilio/voice
 */

import { Router } from 'express';
import pkg from 'twilio';
const { twiml } = pkg;

const router = Router();

router.post('/voice', async (req, res) => {
  console.log('[CALL START]');
  try {
    const response = new twiml.VoiceResponse();
    const gather = response.gather({
      numDigits: 1,
      timeout: 10,
      action: '/twilio/language-select',
      method: 'POST'
    });
    gather.say(
      {
        voice: 'alice',
        language: 'en-US'
      },
      'For English, press 1. For Arabic, press 2.'
    );
    response.redirect('/twilio/voice');
    res.type('text/xml');
    return res.send(response.toString());
  } catch (err) {
    console.error('[ERROR]', 'voice-webhook /twilio/voice failed', err);
    const fallback = new twiml.VoiceResponse();
    fallback.say('System error. Please try again later.');
    res.type('text/xml');
    return res.send(fallback.toString());
  }
});

router.post('/language-select', async (req, res) => {
  try {
    const digit = String(req.body.Digits || '').trim();
    let lang = 'ar';
    if (digit === '1') lang = 'en';
    if (digit === '2') lang = 'ar';
    const recordUrl = `/twilio/recording-complete?lang=${lang}`;
    const response = new twiml.VoiceResponse();

    if (lang === 'ar') {
      // Keep Arabic path audibly reliable across Twilio accounts/voices:
      // some setups go silent on ar-SA TTS. Use en-US instruction and still accept Arabic speech.
      response.say(
        { voice: 'alice', language: 'en-US' },
        'Arabic selected. Please say your request in Arabic after the beep. When you are done, hang up.',
      );
    } else {
      response.say(
        { voice: 'alice', language: 'en-US' },
        "Hi. This is the restaurant booking assistant. I can help you make a reservation.",
      );
      response.pause({ length: 1 });
      response.say(
        { voice: 'alice', language: 'en-US' },
        "Please say your booking request after the beep. When you're done, you can hang up.",
      );
    }

    response.record({
      playBeep: true,
      timeout: 3,
      maxLength: 30,
      action: recordUrl,
      method: 'POST',
    });

    res.type('text/xml');
    return res.send(response.toString());
  } catch (err) {
    console.error('[ERROR]', 'voice-webhook /twilio/language-select failed', err);
    const fallback = new twiml.VoiceResponse();
    fallback.say('System error. Please try again later.');
    res.type('text/xml');
    return res.send(fallback.toString());
  }
});

export default router;
