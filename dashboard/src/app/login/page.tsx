'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold text-stone-800">Sign in</h1>
      <p className="mt-1 text-sm text-stone-600">
        Enter your email and password.
      </p>
      <form onSubmit={signInWithEmail} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-stone-800 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}
      <p className="mt-6">
        <a href="/" className="text-stone-500 hover:underline">← Back</a>
      </p>
    </main>
  );
}
