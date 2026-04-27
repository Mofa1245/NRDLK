import { Router } from 'express';
import { handleWhatsappMessage } from '../whatsapp/handler.js';
import { resolveBusinessByPhone } from '../business/resolve.js';
import { enforceUsage, sendUsageLimitWarning, handleUsageStateAlerts } from '../business/usage.js';
import { trackErrorAlert } from '../alerts/alerts.js';
import { getSession } from '../context/session.js';

const router = Router();

router.post('/whatsapp', async (req, res) => {
  try {
    const from = String(req.body.From || '');
    const message = req.body.Body;
    const to = req.body.To;
    console.log('[WHATSAPP IN]', { from, to, body: String(message || '').slice(0, 120) });
    const senderId = from.replace(/^whatsapp:/i, '').trim();
    const session = getSession(senderId);
    const sessionBusinessId = (session.state as any)?.confirmation?.business_id as string | undefined;

    let business = null as Awaited<ReturnType<typeof resolveBusinessByPhone>> | null;
    if (sessionBusinessId) {
      // Active confirmation session exists: allow replies even when To is Twilio sandbox number.
      business = { business_id: sessionBusinessId, status: 'active', whatsapp_number: null } as any;
    } else {
      business = await resolveBusinessByPhone(to);
      if (!business || business.status !== 'active') {
        return res.status(200).end();
      }
    }

    if (!sessionBusinessId) {
      const usageState = await enforceUsage(business as any);
      await handleUsageStateAlerts(usageState, business as any);
      if (usageState === 'HARD_LIMIT') {
        await sendUsageLimitWarning((business as any).whatsapp_number || process.env.BUSINESS_WHATSAPP_NUMBER);
        return res.status(200).end();
      }
      if (usageState === 'WARNING') {
        await sendUsageLimitWarning((business as any).whatsapp_number || process.env.BUSINESS_WHATSAPP_NUMBER);
      }
    }

    await handleWhatsappMessage(from, message, (business as any).business_id);
    return res.status(200).end();
  } catch (e) {
    console.error('[ERROR]', e);
    await trackErrorAlert('whatsapp-webhook');
    return res.status(200).end();
  }
});

export default router;
