import twilio from 'twilio';

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
  }
  return twilio(sid, token);
}

function normalizeWhatsAppNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  return `whatsapp:${trimmed}`;
}

export async function sendWhatsApp(message: string, toNumber?: string) {
  try {
    if (process.env.DRY_RUN === '1') {
      console.log('[POSTCALL]', JSON.stringify({ to: toNumber || process.env.TWILIO_WHATSAPP_TO, message }));
      return;
    }

    const rawFrom = process.env.TWILIO_WHATSAPP_FROM;
    const rawTo = toNumber || process.env.TWILIO_WHATSAPP_TO;

    if (!rawFrom || !rawTo) {
      throw new Error('Set TWILIO_WHATSAPP_FROM and TWILIO_WHATSAPP_TO in environment');
    }
    const from = normalizeWhatsAppNumber(rawFrom);
    const to = normalizeWhatsAppNumber(rawTo);

    const client = getClient();
    const res = await client.messages.create({
      from,
      to,
      body: message,
    });

    console.log('[POSTCALL]', JSON.stringify({ to, sid: res.sid }));
  } catch (err) {
    console.error('[ERROR]', err);
  }
}
