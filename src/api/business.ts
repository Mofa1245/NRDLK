import { Router } from 'express';
import { getSupabase } from '../db/supabase.js';

const router = Router();

router.patch('/business/:id/status', async (req, res) => {
  try {
    const supabase = await getSupabase();
    const { id } = req.params;
    const { status } = req.body as { status?: 'active' | 'paused' | 'limited' };
    const { error } = await supabase.from('businesses').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/business/:id/plan', async (req, res) => {
  try {
    const supabase = await getSupabase();
    const { id } = req.params;
    const { plan } = req.body as { plan?: 'basic' | 'premium' };
    const { error } = await supabase.from('businesses').update({ plan, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/business/:id/reset-usage', async (req, res) => {
  try {
    const supabase = await getSupabase();
    const { id } = req.params;
    const { error } = await supabase.from('businesses').update({ usage_minutes: 0, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/business/:id/realtime-toggle', async (req, res) => {
  try {
    const supabase = await getSupabase();
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    const { error } = await supabase.from('businesses').update({ ai_enabled: Boolean(enabled), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
