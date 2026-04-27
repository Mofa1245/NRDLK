'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function DashboardSetupPage() {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [plan, setPlan] = useState<'basic' | 'premium'>('basic');
  const [message, setMessage] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setMessage('Login required');
      return;
    }
    const { data: linked } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!linked?.business_id) {
      setMessage('Business not linked');
      return;
    }
    await supabase
      .from('businesses')
      .update({
        name,
        phone_number: phone,
        whatsapp_number: whatsapp,
        plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', linked.business_id);
    location.href = '/dashboard';
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Setup</h1>
      <form onSubmit={save} className="mt-6 space-y-3">
        <input className="w-full rounded border px-3 py-2" placeholder="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded border px-3 py-2" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="w-full rounded border px-3 py-2" placeholder="WhatsApp number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
        <select className="w-full rounded border px-3 py-2" value={plan} onChange={(e) => setPlan(e.target.value as 'basic' | 'premium')}>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
        </select>
        <div className="rounded border bg-stone-50 p-3 text-sm">
          Twilio setup: set Voice webhook to `/twilio/voice`, WhatsApp webhook to `/twilio/whatsapp`, recording callback to `/twilio/recording-complete`.
        </div>
        <button className="rounded bg-stone-800 px-4 py-2 text-white">Save setup</button>
      </form>
      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
    </main>
  );
}
