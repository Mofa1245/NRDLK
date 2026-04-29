'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function generateSampleBusiness() {
    const names = ['Lusail Garden', 'Doha Terrace', 'Pearl Majlis', 'Corniche House', 'Saffron Court'];
    const pick = names[Math.floor(Math.random() * names.length)];
    const suffix = Math.floor(100 + Math.random() * 900);
    setName(`${pick} ${suffix}`);
    setPhoneNumber(`+9743${Math.floor(1000000 + Math.random() * 8999999)}`);
    setWhatsappNumber(`+9743${Math.floor(1000000 + Math.random() * 8999999)}`);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      setMessage(error?.message || 'Signup failed');
      setLoading(false);
      return;
    }

    const { data: business, error: bErr } = await supabase
      .from('businesses')
      .insert({
        business_id: crypto.randomUUID(),
        name,
        phone_number: phoneNumber,
        whatsapp_number: whatsappNumber,
      })
      .select('id')
      .single();

    if (bErr || !business) {
      setMessage(bErr?.message || 'Business creation failed');
      setLoading(false);
      return;
    }

    await supabase.from('users').upsert({
      id: crypto.randomUUID(),
      email,
      role: 'client',
      business_id: business.id,
    });

    await supabase.from('business_users').upsert({
      business_id: business.id,
      user_id: data.user.id,
    });

    setLoading(false);
    router.push('/dashboard/setup');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-14">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Create business account</h1>
          <button
            type="button"
            onClick={generateSampleBusiness}
            className="rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
          >
            Generate sample
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-600">Set up your profile in under a minute.</p>

        <form className="mt-6 grid gap-3" onSubmit={handleSignup}>
          <input className="rounded-md border border-stone-300 px-3 py-2" placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-md border border-stone-300 px-3 py-2" placeholder="Phone number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
          <input className="rounded-md border border-stone-300 px-3 py-2" placeholder="WhatsApp number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} required />
          <input className="rounded-md border border-stone-300 px-3 py-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded-md border border-stone-300 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button disabled={loading} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        {message && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
      </section>
      <p className="mt-4 text-sm text-stone-600">
        Already have an account? <Link href="/login" className="font-medium hover:underline">Sign in</Link>
      </p>
    </main>
  );
}
