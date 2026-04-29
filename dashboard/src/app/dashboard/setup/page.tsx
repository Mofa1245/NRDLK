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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">Business setup</h1>
        <p className="mt-2 text-sm text-stone-600">Finalize your profile and go live with a polished call flow.</p>

        <form onSubmit={save} className="mt-6 grid gap-3 md:grid-cols-2">
          <input className="w-full rounded-md border border-stone-300 px-3 py-2 md:col-span-2" placeholder="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="w-full rounded-md border border-stone-300 px-3 py-2" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <input className="w-full rounded-md border border-stone-300 px-3 py-2" placeholder="WhatsApp number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
          <select className="w-full rounded-md border border-stone-300 px-3 py-2 md:col-span-2" value={plan} onChange={(e) => setPlan(e.target.value as 'basic' | 'premium')}>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
          </select>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 md:col-span-2">
            Twilio setup: set Voice webhook to `/twilio/voice`, WhatsApp webhook to `/twilio/whatsapp`, recording callback to `/twilio/recording-complete`.
          </div>
          <button className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white md:col-span-2">Save setup</button>
        </form>
      </section>
      {message && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
    </main>
  );
}
