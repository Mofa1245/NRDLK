'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OwnerBusinessActions({ businessId }: { businessId: string }) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function patch(path: 'status' | 'plan', body: Record<string, unknown>) {
    setLoading(true);
    setMsg('');
    const res = await fetch(`/api/backend/api/business/${businessId}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res || !res.ok) {
      setMsg('Action failed');
      setLoading(false);
      return;
    }
    setMsg('Updated');
    setLoading(false);
    router.refresh();
  }

  return (
    <section className="mt-4 rounded border bg-white p-3">
      <h2 className="text-sm font-medium">Account Controls</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button disabled={loading} onClick={() => patch('status', { status: 'active' })} className="rounded border px-2 py-1">
          Reactivate
        </button>
        <button disabled={loading} onClick={() => patch('status', { status: 'paused' })} className="rounded border px-2 py-1">
          Pause
        </button>
        <button disabled={loading} onClick={() => patch('plan', { plan: 'basic' })} className="rounded border px-2 py-1">
          Plan Basic
        </button>
        <button disabled={loading} onClick={() => patch('plan', { plan: 'premium' })} className="rounded border px-2 py-1">
          Plan Premium
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-stone-600">{msg}</p> : null}
    </section>
  );
}
