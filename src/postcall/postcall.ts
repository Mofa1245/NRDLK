import { shouldEscalate } from '../handoff/handoff.js';
import { sendWhatsApp } from '../whatsapp/send.js';
import { trackUsage } from '../billing/usage.js';
import { incrementUsage } from '../business/usage.js';
import { alertHighHandoffRate, trackErrorAlert } from '../alerts/alerts.js';
import { getSession, updateSession } from '../context/session.js';
import { getSupabase } from '../db/supabase.js';

export async function handlePostCall({
  callId,
  businessId,
  from,
  transcript,
  structured,
  confidence,
  duration,
  mode
}: {
  callId: string;
  businessId: string;
  from: string;
  transcript: string;
  structured: any;
  confidence: number;
  duration: number;
  mode?: 'realtime' | 'fallback';
}) {
  try {
    await logCall({
      callId,
      businessId,
      from,
      transcript,
      structured,
      confidence,
      duration
    });

    const escalate = shouldEscalate(structured, confidence, transcript);
    const resolvedMode: 'realtime' | 'fallback' =
      mode || (process.env.ENABLE_REALTIME_STREAM === '1' ? 'realtime' : 'fallback');
    const lang = resolveLanguage(transcript, structured);

    if (escalate) {
      console.log('[HANDOFF]');
      const businessTarget = process.env.BUSINESS_WHATSAPP_NUMBER;
      const sameRecipient = isSameWhatsAppRecipient(businessTarget, from);

      if (!sameRecipient) {
        await sendWhatsApp(
          formatBusinessNotification(lang, {
            phone: from,
            transcript,
            structured
          }),
          businessTarget
        );
      }

      upsertConfirmationSession(from, lang, structured, businessId, callId, transcript);
      await sendWhatsApp(`${formatHandoffCustomerMessage(lang)}${formatConfirmationMenu(lang)}`, from);
      await alertHighHandoffRate(businessId, 1);

      const outcome: 'handoff' | 'success' = 'handoff';
      trackUsage({
        callId,
        businessId,
        mode: resolvedMode,
        duration,
        outcome
      });
      await incrementUsage(businessId, duration, resolvedMode);
      console.log('[POSTCALL]', outcome);
      return;
    }

    const message = confidence < 0.7
      ? formatLowConfidenceMessage(lang, structured)
      : formatSuccessMessage(lang, structured, resolvedMode);
    upsertConfirmationSession(from, lang, structured, businessId, callId, transcript);
    await sendWhatsApp(`${message}${formatConfirmationMenu(lang)}`, from);
    const outcome: 'handoff' | 'success' = 'success';
    trackUsage({
      callId,
      businessId,
      mode: resolvedMode,
      duration,
      outcome
    });
    await incrementUsage(businessId, duration, resolvedMode);
    console.log('[POSTCALL]', outcome);
  } catch (e) {
    console.error('[ERROR]', e);
    await trackErrorAlert('postcall');
    await sendWhatsApp('نعتذر، سيتم التواصل معك قريباً', from);
  }
}

async function logCall(data: {
  callId: string;
  businessId: string;
  from: string;
  transcript: string;
  structured: any;
  confidence: number;
  duration: number;
}) {
  console.log('[POSTCALL]', JSON.stringify(data));
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('call_logs').insert({
      call_id: data.callId,
      business_id: data.businessId,
      timestamp: new Date().toISOString(),
      transcript: data.transcript || null,
      llm_output_json: data.structured || null,
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
      flagged: (data.structured?.intent || 'unknown') === 'unknown',
      high_priority: false,
      duration_seconds: Number.isFinite(data.duration) ? data.duration : null,
      caller_phone: data.from || null,
      fallback_reason: data.structured?._parse_fallback_reason || null,
    });
    if (error) {
      console.error('[ERROR]', 'call_logs insert failed', error.message);
    }
  } catch (e) {
    console.error('[ERROR]', 'call_logs insert failed', e);
  }
}

function normalizePhoneForCompare(value?: string | null): string {
  return String(value || '')
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .trim();
}

function isSameWhatsAppRecipient(a?: string | null, b?: string | null): boolean {
  const left = normalizePhoneForCompare(a);
  const right = normalizePhoneForCompare(b);
  return !!left && !!right && left === right;
}

function resolveLanguage(transcript: string, structured: any): 'ar' | 'en' {
  if (structured?._lang === 'ar' || structured?._lang === 'en') {
    return structured._lang;
  }
  return /[\u0600-\u06FF]/.test(transcript || '') ? 'ar' : 'en';
}

function bookingDateLabel(lang: 'ar' | 'en', structured: any): string {
  const provided =
    structured?.date ||
    structured?.booking_date ||
    structured?.day ||
    structured?.requested_date;
  if (typeof provided === 'string' && provided.trim()) return provided.trim();
  return lang === 'ar'
    ? new Date().toLocaleDateString('ar-QA')
    : new Date().toLocaleDateString('en-GB');
}

function formatSuccessMessage(lang: 'ar' | 'en', structured: any, mode: 'realtime' | 'fallback') {
  const people = structured?.number_of_people ?? '—';
  const time = structured?.time ?? '—';
  const date = bookingDateLabel(lang, structured);
  const special = structured?.special_request ?? '—';
  if (mode === 'realtime') {
    return lang === 'ar' ? 'تم استلام الحجز، نكمل معك هنا 👍' : "Booking received. We'll continue here 👍";
  }
  if (lang === 'ar') {
    return `تم استلام طلب الحجز ✅

التاريخ: ${date}
الوقت: ${time}
عدد الأشخاص: ${people}
طلب خاص: ${special}

إذا رغبت بالتعديل، يرجى الرد على هذه الرسالة.

سيتم تأكيد الحجز من فريق المطعم قريباً.`;
  }
  return `Your booking has been received ✅

Date: ${date}
Time: ${time}
Party size: ${people}
Special request: ${special}

If you would like to make any changes, please reply to this message.

The restaurant team will confirm your booking shortly.`;
}

function formatLowConfidenceMessage(lang: 'ar' | 'en', structured: any) {
  const people = structured?.number_of_people ?? '—';
  const time = structured?.time ?? '—';
  const date = bookingDateLabel(lang, structured);
  const special = structured?.special_request ?? '—';
  if (lang === 'ar') {
    return `يرجى تأكيد تفاصيل الحجز:

التاريخ: ${date}
الوقت: ${time}
عدد الأشخاص: ${people}
طلب خاص: ${special}

يرجى الرد بـ "نعم" للتأكيد أو إرسال التعديل المطلوب.`;
  }
  return `Please confirm your booking details:

Date: ${date}
Time: ${time}
Party size: ${people}
Special request: ${special}

Reply "yes" to confirm, or send the correction.`;
}

function formatHandoffCustomerMessage(lang: 'ar' | 'en') {
  return lang === 'ar'
    ? 'تم استلام الحجز، وسيتواصل معك المطعم قريباً 👍'
    : 'Your booking is received. The restaurant will contact you shortly 👍';
}

function formatConfirmationMenu(lang: 'ar' | 'en') {
  if (lang === 'ar') {
    return `\n\nللمتابعة، رد برقم:
1) تأكيد الحجز
2) تعديل الوقت
3) تعديل عدد الأشخاص
4) إضافة طلب خاص
5) تحويل لموظف
6) تعديل التاريخ

ملاحظة: يمكنك التعديل حتى 3 مرات خلال 10 دقائق، وبعدها يتم تثبيت الطلب تلقائياً.`;
  }
  return `\n\nReply with:
1) Confirm booking
2) Change time
3) Change party size
4) Add special request
5) Human support
6) Change date

Note: You can edit up to 3 times within 10 minutes, then the request is auto-locked.`;
}

function upsertConfirmationSession(
  from: string,
  lang: 'ar' | 'en',
  structured: any,
  businessId: string,
  callId: string,
  transcript: string,
) {
  const s = getSession(from);
  const state = s.state || {};
  const now = Date.now();
  updateSession(from, {
    state: {
      ...state,
      confirmation: {
        active: true,
        lang,
        business_id: businessId,
        call_id: callId,
        created_at: now,
        expires_at: now + 10 * 60 * 1000,
        max_changes: 3,
        changes_count: 0,
        pending_field: null,
        data: {
          date: structured?.date || structured?.booking_date || structured?.requested_date || null,
          time: structured?.time ?? null,
          number_of_people: structured?.number_of_people ?? null,
          special_request: structured?.special_request ?? null,
          details_text: transcript || null,
        },
      },
    },
  });
}

function formatBusinessNotification(
  lang: 'ar' | 'en',
  data: { phone: string; transcript: string; structured: any }
) {
  const people = data.structured?.number_of_people ?? '—';
  const time = data.structured?.time ?? '—';
  const date = bookingDateLabel(lang, data.structured);
  const special = data.structured?.special_request ?? '—';
  if (lang === 'ar') {
    return `حجز جديد

👤 العدد: ${people}
🕒 الوقت: ${time}
📅 التاريخ: ${date}
📝 طلب خاص: ${special}
📞 الرقم: ${data.phone}

📄 التفاصيل:
${data.transcript}

تواصل مع العميل إذا احتجت تفاصيل إضافية.`;
  }
  return `New Booking

👤 People: ${people}
🕒 Time: ${time}
📅 Date: ${date}
📝 Special request: ${special}
📞 Phone: ${data.phone}

📄 Details:
${data.transcript}

Contact the customer only if you need more details.`;
}
