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
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <form className="mt-6 flex flex-col gap-3" onSubmit={handleSignup}>
        <input className="rounded border px-3 py-2" placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="rounded border px-3 py-2" placeholder="Phone number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
        <input className="rounded border px-3 py-2" placeholder="WhatsApp number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} required />
        <input className="rounded border px-3 py-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded border px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={loading} className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-60">
          {loading ? 'Creating...' : 'Sign up'}
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      <p className="mt-4 text-sm text-stone-600">
        Already have an account? <Link href="/login" className="hover:underline">Sign in</Link>
      </p>
    </main>
  );
}
