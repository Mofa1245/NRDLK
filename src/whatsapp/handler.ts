import { sendWhatsApp } from './send.js';
import { getSession, updateSession, clearSession } from '../context/session.js';
import { processMessage } from './ai.js';
import { isRateLimited } from '../security/rate-limit.js';
import { trackErrorAlert } from '../alerts/alerts.js';
import { getSupabase } from '../db/supabase.js';

function toLang(session: any): 'ar' | 'en' {
  const lang = session?.state?.confirmation?.lang;
  return lang === 'en' ? 'en' : 'ar';
}

function summaryMessage(lang: 'ar' | 'en', data: any) {
  const date = data?.date || (lang === 'ar' ? new Date().toLocaleDateString('ar-QA') : new Date().toLocaleDateString('en-GB'));
  const time = data?.time ?? '—';
  const people = data?.number_of_people ?? '—';
  const special = data?.special_request ?? '—';
  if (lang === 'ar') {
    return `ملخص الحجز النهائي:

👤 ${people} أشخاص
🕒 ${time}
📅 ${date}
📝 ${special}`;
  }
  return `Final booking summary:

👤 ${people} people
🕒 ${time}
📅 ${date}
📝 ${special}`;
}

function actionMenu(lang: 'ar' | 'en') {
  if (lang === 'ar') {
    return `\n\nرد برقم:
1) تأكيد الحجز
2) تعديل الوقت
3) تعديل عدد الأشخاص
4) إضافة طلب خاص
5) تحويل لموظف
6) تعديل التاريخ

رد بـ 1 لتأكيد الحجز أو اختر خياراً للتعديل.

يمكنك التعديل 3 مرات كحد أقصى خلال 10 دقائق.`;
  }
  return `\n\nReply with:
1) Confirm booking
2) Change time
3) Change party size
4) Add special request
5) Human support
6) Change date

Reply 1 to confirm, or choose an option to edit.

You can edit up to 3 times within 10 minutes.`;
}

function normalizeIncoming(text: string): string {
  return String(text || '').trim().toLowerCase();
}

function parsePeople(text: string): number | null {
  const m = text.match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0 || n > 50) return null;
  return n;
}

function parseDateInput(text: string, lang: 'ar' | 'en'): string | null {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return null;
  const today = new Date();
  if (['today', 'اليوم'].includes(raw)) return today.toISOString().slice(0, 10);
  if (['tomorrow', 'tmr', 'بكرة', 'بكرا'].includes(raw)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  void lang;
  return null;
}

async function createConfirmedBooking(input: {
  business_id: string;
  call_id?: string | null;
  customer_phone: string;
  booking_date?: string | null;
  booking_time?: string | null;
  party_size?: number | null;
  special_request?: string | null;
  language?: string | null;
  corrected_by_customer?: boolean;
  details_text?: string | null;
  status?: 'confirmed' | 'handoff';
}) {
  const supabase = await getSupabase();
  const { data: bizRow, error: bizErr } = await supabase
    .from('businesses')
    .select('id')
    .eq('business_id', input.business_id)
    .maybeSingle();
  if (bizErr) throw new Error(bizErr.message);
  const businessRowId = (bizRow as any)?.id as string | undefined;
  if (!businessRowId) throw new Error(`business not found for business_id=${input.business_id}`);

  const payload = {
    business_id: businessRowId,
    call_id: input.call_id ?? null,
    customer_phone: input.customer_phone,
    booking_date: input.booking_date ?? null,
    booking_time: input.booking_time ?? null,
    party_size: input.party_size ?? null,
    special_request: input.special_request ?? null,
    language: input.language ?? null,
    corrected_by_customer: Boolean(input.corrected_by_customer),
    details_text: input.details_text ?? null,
    status: input.status || 'confirmed',
    confirmed_at: (input.status || 'confirmed') === 'confirmed' ? new Date().toISOString() : null,
  };

  let data: any = null;
  let error: any = null;
  try {
    ({ data, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select('id,customer_phone,booking_time,party_size')
      .single());
  } catch (e) {
    error = e;
  }

  if ((error && /details_text/i.test(String((error as any)?.message || error || ''))) || !data) {
    // Backward-compatible path: DB migration not applied yet.
    const legacyPayload = { ...payload } as Record<string, unknown>;
    delete legacyPayload.details_text;
    let legacyData: any = null;
    let legacyError: any = null;
    try {
      ({ data: legacyData, error: legacyError } = await supabase
        .from('bookings')
        .insert(legacyPayload)
        .select('id,customer_phone,booking_time,party_size')
        .single());
      data = legacyData;
      error = legacyError;
    } catch (e) {
      error = e;
    }
  }
  if (error) throw new Error(error.message);
  console.log('[BOOKING CREATED]', data);
  console.log('[BOOKING CONFIRMED]', { phone: input.customer_phone, business_id: input.business_id });
  return data;
}

async function sendBusinessBookingNotice(input: {
  business_id: string;
  customer_phone: string;
  booking_date?: string | null;
  party_size?: number | null;
  booking_time?: string | null;
  special_request?: string | null;
}) {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('businesses')
    .select('whatsapp_number')
    .eq('business_id', input.business_id)
    .maybeSingle();
  const to = (data as any)?.whatsapp_number || process.env.BUSINESS_WHATSAPP_NUMBER;
  const date = String(input.booking_date || '').trim() || 'Today';
  const msg = `New Booking

👤 ${input.party_size ?? '—'} people
🕒 ${input.booking_time ?? '—'}
📅 ${date}
📞 ${input.customer_phone}

📝 ${input.special_request?.trim() || '—'}

Open dashboard to manage.`;
  await sendWhatsApp(msg, to);
}

function normalizeSessionId(phone: string): string {
  return String(phone || '').replace(/^whatsapp:/i, '').trim();
}

export async function handleWhatsappMessage(from: string, message: string, businessId?: string) {
  try {
    const sessionId = normalizeSessionId(from);
    if (process.env.DEMO_MODE !== '1' && isRateLimited(sessionId)) {
      await sendWhatsApp('تم إرسال عدد كبير من الرسائل، حاول لاحقاً.', sessionId);
      return;
    }

    const session = getSession(sessionId);
    const confirmation = (session.state as any)?.confirmation;
    if (confirmation?.active) {
      const lang = toLang(session);
      const normalized = normalizeIncoming(message);
      const data = { ...(confirmation.data || {}) };
      const pending = confirmation.pending_field as null | 'time' | 'people' | 'special_request' | 'date';
      const now = Date.now();
      const expiresAt = Number(confirmation.expires_at || 0);
      const maxChanges = Number(confirmation.max_changes || 3);
      const changesCount = Number(confirmation.changes_count || 0);

      if (Number.isFinite(expiresAt) && expiresAt > 0 && now > expiresAt) {
        const lockedMsg =
          lang === 'ar'
            ? `انتهت مهلة التعديل (10 دقائق) وتم تثبيت آخر نسخة من الطلب ✅\n\n${summaryMessage(lang, data)}`
            : `The 10-minute edit window has ended. Your latest version is now locked ✅\n\n${summaryMessage(lang, data)}`;
        await sendWhatsApp(lockedMsg, sessionId);
        clearSession(sessionId);
        return;
      }

      if (pending === 'time') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          updateSession(sessionId, {
            state: {
              ...session.state,
              confirmation: { ...confirmation, pending_field: null },
            },
          });
          return;
        }
        data.time = String(message || '').trim() || data.time;
        updateSession(sessionId, {
          state: {
            ...session.state,
            confirmation: {
              ...confirmation,
              data,
              pending_field: null,
              changes_count: changesCount + 1,
            },
          },
        });
        await sendWhatsApp(`${summaryMessage(lang, data)}${actionMenu(lang)}`, sessionId);
        return;
      }
      if (pending === 'people') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          updateSession(sessionId, {
            state: {
              ...session.state,
              confirmation: { ...confirmation, pending_field: null },
            },
          });
          return;
        }
        const n = parsePeople(message);
        if (!n) {
          await sendWhatsApp(lang === 'ar' ? 'الرجاء إرسال عدد الأشخاص كرقم (مثال: 4).' : 'Please send party size as a number (e.g. 4).', sessionId);
          return;
        }
        data.number_of_people = n;
        updateSession(sessionId, {
          state: {
            ...session.state,
            confirmation: {
              ...confirmation,
              data,
              pending_field: null,
              changes_count: changesCount + 1,
            },
          },
        });
        await sendWhatsApp(`${summaryMessage(lang, data)}${actionMenu(lang)}`, sessionId);
        return;
      }
      if (pending === 'special_request') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          updateSession(sessionId, {
            state: {
              ...session.state,
              confirmation: { ...confirmation, pending_field: null },
            },
          });
          return;
        }
        data.special_request = String(message || '').trim() || '—';
        updateSession(sessionId, {
          state: {
            ...session.state,
            confirmation: {
              ...confirmation,
              data,
              pending_field: null,
              changes_count: changesCount + 1,
            },
          },
        });
        await sendWhatsApp(`${summaryMessage(lang, data)}${actionMenu(lang)}`, sessionId);
        return;
      }
      if (pending === 'date') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          updateSession(sessionId, {
            state: {
              ...session.state,
              confirmation: { ...confirmation, pending_field: null },
            },
          });
          return;
        }
        const parsedDate = parseDateInput(message, lang);
        if (!parsedDate) {
          await sendWhatsApp(
            lang === 'ar'
              ? 'أرسل التاريخ بصيغة واضحة: اليوم، بكرة، أو YYYY-MM-DD.'
              : 'Send date as: today, tomorrow, or YYYY-MM-DD.',
            sessionId,
          );
          return;
        }
        data.date = parsedDate;
        updateSession(sessionId, {
          state: {
            ...session.state,
            confirmation: {
              ...confirmation,
              data,
              pending_field: null,
              changes_count: changesCount + 1,
            },
          },
        });
        await sendWhatsApp(`${summaryMessage(lang, data)}${actionMenu(lang)}`, sessionId);
        return;
      }

      if (['1', 'yes', 'y', 'نعم', 'تأكيد', 'confirm'].includes(normalized)) {
        if (data.number_of_people == null || String(data.time || '').trim() === '') {
          await sendWhatsApp(
            lang === 'ar'
              ? `لا يمكن تثبيت الطلب قبل استكمال البيانات الأساسية.\n\n${summaryMessage(lang, data)}${actionMenu(lang)}`
              : `Cannot finalize yet. Please complete required fields first.\n\n${summaryMessage(lang, data)}${actionMenu(lang)}`,
            sessionId,
          );
          return;
        }
        const date = String(data.date || '').trim() || new Date().toISOString().slice(0, 10);
        await createConfirmedBooking({
          business_id: String(confirmation.business_id || ''),
          call_id: String(confirmation.call_id || '') || null,
          customer_phone: sessionId,
          booking_date: date,
          booking_time: String(data.time || '').trim() || null,
          party_size: Number(data.number_of_people ?? null),
          special_request: String(data.special_request || '').trim() || null,
          language: lang,
          corrected_by_customer: changesCount > 0,
          details_text: String(data.details_text || '').trim() || null,
        });
        await sendBusinessBookingNotice({
          business_id: String(confirmation.business_id || ''),
          customer_phone: sessionId,
          booking_date: date,
          party_size: Number(data.number_of_people ?? null),
          booking_time: String(data.time || '').trim() || null,
          special_request: String(data.special_request || '').trim() || null,
        });
        const finalMsg =
          lang === 'ar'
            ? `تم تأكيد حجزك ✅\nسيتواصل معك المطعم عند الحاجة.`
            : `Your booking is confirmed ✅\nThe restaurant will contact you if needed.`;
        await sendWhatsApp(finalMsg, sessionId);
        clearSession(sessionId);
        return;
      }
      if (normalized === '2') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          return;
        }
        updateSession(sessionId, { state: { ...session.state, confirmation: { ...confirmation, pending_field: 'time' } } });
        await sendWhatsApp(lang === 'ar' ? 'أرسل الوقت المطلوب بصيغة واضحة (مثال: 7:45pm).' : 'Send the preferred time clearly (e.g. 7:45pm).', sessionId);
        return;
      }
      if (normalized === '3') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          return;
        }
        updateSession(sessionId, { state: { ...session.state, confirmation: { ...confirmation, pending_field: 'people' } } });
        await sendWhatsApp(lang === 'ar' ? 'أرسل عدد الأشخاص كرقم (مثال: 4).' : 'Send party size as a number (e.g. 4).', sessionId);
        return;
      }
      if (normalized === '4') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          return;
        }
        updateSession(sessionId, { state: { ...session.state, confirmation: { ...confirmation, pending_field: 'special_request' } } });
        await sendWhatsApp(lang === 'ar' ? 'اكتب طلبك الخاص كما تريد (خارجي/داخلي/غرفة خاصة/أي ملاحظة).' : 'Type your special request exactly as you want (outdoor/indoor/private room/notes).', sessionId);
        return;
      }
      if (normalized === '5') {
        const date = String(data.date || '').trim() || new Date().toISOString().slice(0, 10);
        await createConfirmedBooking({
          business_id: String(confirmation.business_id || ''),
          call_id: String(confirmation.call_id || '') || null,
          customer_phone: sessionId,
          booking_date: date,
          booking_time: String(data.time || '').trim() || null,
          party_size: Number(data.number_of_people ?? null),
          special_request:
            String(data.special_request || '').trim() ||
            (lang === 'ar' ? 'طلب دعم بشري عاجل' : 'Urgent human support requested'),
          language: lang,
          corrected_by_customer: changesCount > 0,
          details_text: String(data.details_text || '').trim() || null,
          status: 'handoff',
        });
        await sendWhatsApp(lang === 'ar' ? 'تم تحويل طلبك لموظف، وسيتواصل معك قريباً.' : 'Your request was handed to a staff member. They will contact you shortly.', sessionId);
        clearSession(sessionId);
        return;
      }
      if (normalized === '6') {
        if (changesCount >= maxChanges) {
          await sendWhatsApp(
            lang === 'ar'
              ? `وصلت الحد الأقصى للتعديلات (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nرد بـ 1 لتأكيد الطلب أو 5 للتحويل لموظف.`
              : `You reached the maximum edits (${maxChanges}).\n\n${summaryMessage(lang, data)}\n\nReply 1 to confirm or 5 for human support.`,
            sessionId,
          );
          return;
        }
        updateSession(sessionId, { state: { ...session.state, confirmation: { ...confirmation, pending_field: 'date' } } });
        await sendWhatsApp(
          lang === 'ar'
            ? 'أرسل التاريخ المطلوب: اليوم، بكرة، أو YYYY-MM-DD.'
            : 'Send booking date: today, tomorrow, or YYYY-MM-DD.',
          sessionId,
        );
        return;
      }

      await sendWhatsApp(`${summaryMessage(lang, data)}${actionMenu(lang)}`, sessionId);
      return;
    }

    const current = {
      intent: (session.state.intent as string | null | undefined) ?? null,
      number_of_people: (session.state.number_of_people as number | null | undefined) ?? null,
      time: (session.state.time as string | null | undefined) ?? null
    };
    const ai = await processMessage(current, message).catch(() => ({
      intent: current.intent,
      number_of_people: current.number_of_people,
      time: current.time,
      reply: 'ممكن توضح أكثر؟'
    }));

    const mergedState = {
      ...session.state,
      intent: ai.intent || current.intent,
      number_of_people: ai.number_of_people || current.number_of_people,
      time: ai.time || current.time
    };

    const merged = updateSession(sessionId, {
      structured: {
        ...((session.structured as Record<string, unknown>) || {}),
        businessId: businessId || ((session.structured as Record<string, unknown>)?.businessId as string | undefined)
      },
      state: mergedState
    });

    await sendWhatsApp(ai.reply || 'نعتذر، سيتم التواصل معك قريباً', sessionId);

    if (
      mergedState.intent === 'booking' &&
      mergedState.number_of_people &&
      mergedState.time
    ) {
      clearSession(sessionId);
    }
    void merged;
  } catch (e) {
    console.error('[ERROR]', e);
    await trackErrorAlert('whatsapp-handler');
    await sendWhatsApp('نعتذر، سيتم التواصل معك قريباً', from);
  }
}
