/**
 * Example WhatsApp sender that logs to console (for testing).
 * Replace with Twilio / WhatsApp Business API in production.
 */

import type { WhatsAppPayload, WhatsAppSender } from './sender.js';

export const consoleWhatsAppSender: WhatsAppSender = {
  async send(payload: WhatsAppPayload): Promise<void> {
    console.log('[WhatsApp] To:', payload.to);
    console.log('[WhatsApp] Flagged:', payload.flagged, 'High priority:', payload.high_priority);
    console.log('[WhatsApp] Message:\n', payload.message);
  },
};
