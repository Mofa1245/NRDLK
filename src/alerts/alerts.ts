import { sendWhatsApp } from '../whatsapp/send.js';

const errorHits = new Map<string, number>();

export async function sendAlert(message: string) {
  const to = process.env.OWNER_WHATSAPP;
  if (!to) return;
  await sendWhatsApp(message, to);
}

export async function trackErrorAlert(scope: string) {
  const next = (errorHits.get(scope) || 0) + 1;
  errorHits.set(scope, next);
  if (next >= 3) {
    await sendAlert(`[ERROR] repeated ${scope} count=${next}`);
  }
}

export async function alertHighHandoffRate(businessId: string, handoffRatio: number) {
  const owner = String(process.env.OWNER_WHATSAPP || '').replace(/^whatsapp:/i, '').trim();
  const customer = String(process.env.TWILIO_WHATSAPP_TO || '').replace(/^whatsapp:/i, '').trim();
  if (owner && customer && owner === customer) {
    // In demo/sandbox setups owner and customer can be the same phone.
    // Never send internal handoff-rate alerts to customer-facing chats.
    return;
  }
  if (handoffRatio >= 0.5) {
    await sendAlert(`[HANDOFF] high_rate ${businessId} ratio=${handoffRatio.toFixed(2)}`);
  }
}
