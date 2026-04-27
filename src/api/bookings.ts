import { Router } from 'express';
import { getSupabase } from '../db/supabase.js';

const router = Router();

router.get('/bookings', async (req, res) => {
  try {
    const businessIdQuery = String(req.query.business_id || '').trim();
    if (!businessIdQuery) {
      return res.status(400).json({ ok: false, error: 'business_id required' });
    }

    const supabase = await getSupabase();
    let businessRowId = businessIdQuery;
    let businessIdText = businessIdQuery;
    // Allow caller to pass business_id text; map to businesses.id uuid for bookings lookup.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessIdQuery)) {
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id,business_id')
        .eq('business_id', businessIdQuery)
        .maybeSingle();
      if (bizErr) return res.status(500).json({ ok: false, error: bizErr.message });
      businessRowId = String((biz as any)?.id || '');
      businessIdText = String((biz as any)?.business_id || businessIdText);
      if (!businessRowId) return res.status(200).json({ ok: true, bookings: [] });
    } else {
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('business_id')
        .eq('id', businessIdQuery)
        .maybeSingle();
      if (bizErr) return res.status(500).json({ ok: false, error: bizErr.message });
      businessIdText = String((biz as any)?.business_id || businessIdQuery);
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', businessRowId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const bookings = (data ?? []) as Array<Record<string, unknown>>;
    const missingDetails = bookings.filter((b) => !String((b.details_text as string) || '').trim() && b.call_id).map((b) => String(b.call_id));
    if (missingDetails.length > 0) {
      const { data: calls } = await supabase
        .from('call_logs')
        .select('call_id,transcript')
        .eq('business_id', businessIdText)
        .in('call_id', missingDetails);
      const transcriptMap = new Map<string, string>();
      for (const c of calls || []) {
        const id = String((c as any).call_id || '');
        const tr = String((c as any).transcript || '');
        if (id && tr) transcriptMap.set(id, tr);
      }
      for (const b of bookings) {
        const existing = String((b.details_text as string) || '').trim();
        const cid = String((b.call_id as string) || '');
        if (!existing && cid && transcriptMap.has(cid)) {
          b.details_text = transcriptMap.get(cid) || null;
        }
      }
    }

    console.log('[BOOKING FETCH]', { business_id: businessIdText, row_id: businessRowId, count: bookings.length });
    return res.status(200).json({ ok: true, bookings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

router.patch('/bookings/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });

    const patch: Record<string, unknown> = {};
    const status = String(req.body?.status || '').trim();
    if (status) {
      const allowed = new Set(['contacted', 'cancelled', 'completed', 'confirmed', 'handoff', 'pending_confirmation']);
      if (!allowed.has(status)) {
        return res.status(400).json({ ok: false, error: 'invalid status' });
      }
      patch.status = status;
      if (status === 'confirmed') patch.confirmed_at = new Date().toISOString();
    }
    if (typeof req.body?.booking_date === 'string') patch.booking_date = req.body.booking_date.trim() || null;
    if (typeof req.body?.booking_time === 'string') patch.booking_time = req.body.booking_time.trim() || null;
    if (req.body?.party_size != null) patch.party_size = Number(req.body.party_size) || null;
    if (typeof req.body?.special_request === 'string') patch.special_request = req.body.special_request.trim() || null;
    if (Object.keys(patch).length === 0) return res.status(400).json({ ok: false, error: 'no fields to update' });

    const supabase = await getSupabase();
    const editedFields = ['booking_date', 'booking_time', 'party_size', 'special_request'].filter((k) =>
      Object.prototype.hasOwnProperty.call(patch, k),
    );
    if (editedFields.length > 0) {
      const { data: existing, error: existingErr } = await supabase
        .from('bookings')
        .select('booking_date,booking_time,party_size,special_request,original_booking')
        .eq('id', id)
        .single();
      if (existingErr) return res.status(500).json({ ok: false, error: existingErr.message });
      patch.updated_by_staff = true;
      if (!(existing as any)?.original_booking) {
        patch.original_booking = {
          booking_date: (existing as any)?.booking_date ?? null,
          booking_time: (existing as any)?.booking_time ?? null,
          party_size: (existing as any)?.party_size ?? null,
          special_request: (existing as any)?.special_request ?? null,
        };
      }
    }
    const { data, error } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, booking: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
