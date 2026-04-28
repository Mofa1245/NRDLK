'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Business = {
  id: string;
  business_id: string;
  name: string;
  business_hours: string;
  ai_enabled: boolean;
  config_version: number;
  status: string;
  plan: string;
  usage_minutes: number;
  monthly_limit_minutes: number;
  whatsapp_number: string | null;
  phone_number: string | null;
} | null;

type Call = {
  id: string;
  call_id: string;
  timestamp: string;
  confidence: number | null;
  flagged: boolean;
  high_priority: boolean;
  duration_seconds: number | null;
};

export function DashboardClient({
  userEmail,
  business,
  usageLogs,
  messages,
  todayCalls,
}: {
  userEmail: string;
  business: Business;
  usageLogs: any[];
  messages: any[];
  todayCalls: Call[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [hours, setHours] = useState(business?.business_hours ?? '');
  const [aiEnabled, setAiEnabled] = useState(business?.ai_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [opMessage, setOpMessage] = useState<string>('');

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  async function saveSettings() {
    if (!business) return;
    setSaving(true);
    setOpMessage('');
    const nextConfigVersion = (business.config_version ?? 1) + 1;
    const { error } = await supabase
      .from('businesses')
      .update({
        business_hours: hours,
        ai_enabled: aiEnabled,
        config_version: nextConfigVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id);
    if (error) {
      setOpMessage(`Failed to save settings: ${error.message}`);
      setSaving(false);
      return;
    }
    setOpMessage('Settings saved.');
    setSaving(false);
    router.refresh();
  }

  async function patchBusiness(path: string, body: Record<string, unknown>) {
    if (!business) return;
    setOpMessage('');
    const res = await fetch(`/api/backend/api/business/${business.id}/${path}`, {
      method: path === 'reset-usage' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res || !res.ok) {
      setOpMessage('Action failed. Check server and try again.');
      return;
    }
    setOpMessage('Action applied.');
    router.refresh();
  }

  function downloadLogs() {
    const rows = [
      ['call_id', 'timestamp', 'confidence', 'flagged', 'high_priority', 'duration_seconds'].join(','),
      ...todayCalls.map((c) =>
        [c.call_id, c.timestamp, c.confidence, c.flagged, c.high_priority, c.duration_seconds].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!business) {
    return (
      <div>
        <p className="text-stone-600">No business linked to your account. Contact support.</p>
        <button onClick={signOut} className="mt-4 text-stone-500 hover:underline">Sign out</button>
      </div>
    );
  }

  const serviceActive = business.status === 'active';
  const planLabel = business.plan === 'premium' ? 'Premium' : 'Basic';
  const usagePercent = Math.round((business.usage_minutes / Math.max(1, business.monthly_limit_minutes)) * 100);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">{business.name}</h1>
          <p className="text-sm text-stone-500">{userEmail}</p>
        </div>
        <button onClick={signOut} className="text-sm text-stone-500 hover:underline">
          Sign out
        </button>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-700">Quick access</h2>
        <p className="mt-1 text-xs text-stone-500">Open live bookings and manage confirmations.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/dashboard/bookings"
            className="inline-flex items-center rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Bookings
          </a>
          {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ? (
            <a
              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Upgrade / Pay
            </a>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-700">Usage Summary</h2>
        <p className="mt-1 text-sm text-stone-700">
          {business.usage_minutes} / {business.monthly_limit_minutes} minutes used this month
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Approx utilization: {Math.round((business.usage_minutes / Math.max(1, business.monthly_limit_minutes)) * 100)}%
        </p>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Operations Center</h2>
            <p className="mt-1 text-sm text-stone-500">Control service status, AI behavior, and business policy.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${serviceActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Service: {serviceActive ? 'Active' : 'Paused'}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800">Plan: {planLabel}</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">Usage: {usagePercent}%</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-stone-200 p-4">
            <h3 className="text-sm font-medium text-stone-800">Reception Behavior</h3>
            <p className="mt-1 text-xs text-stone-500">Define operating window and whether AI answers new calls.</p>

            <label className="mt-3 block text-xs font-medium text-stone-600">Working hours</label>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Example: Sat-Thu 09:00-21:00"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />

            <label className="mt-3 flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
              />
              <span className="text-sm text-stone-700">AI receptionist enabled</span>
            </label>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="mt-3 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Saving changes...' : 'Save configuration'}
            </button>
          </div>

          <div className="rounded-lg border border-stone-200 p-4">
            <h3 className="text-sm font-medium text-stone-800">Administrative Actions</h3>
            <p className="mt-1 text-xs text-stone-500">Use these controls for service lifecycle, billing tier, and counters.</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => patchBusiness('status', { status: 'active' })} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                Activate service
              </button>
              <button onClick={() => patchBusiness('status', { status: 'paused' })} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                Pause service
              </button>
              <button onClick={() => patchBusiness('realtime-toggle', { enabled: !aiEnabled })} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                {aiEnabled ? 'Disable AI receptionist' : 'Enable AI receptionist'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => patchBusiness('plan', { plan: 'basic' })} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                Switch to Basic
              </button>
              <button onClick={() => patchBusiness('plan', { plan: 'premium' })} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                Switch to Premium
              </button>
              <button onClick={() => patchBusiness('reset-usage', {})} className="rounded-md border px-3 py-1.5 text-xs font-medium">
                Reset monthly usage
              </button>
            </div>
          </div>
        </div>

        {opMessage ? <p className="mt-3 text-xs text-stone-600">{opMessage}</p> : null}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-700">Today&apos;s calls</h2>
        <p className="mt-1 text-xs text-stone-500">{todayCalls.length} calls today</p>
        <ul className="mt-3 space-y-2">
          {todayCalls.length === 0 ? (
            <li className="text-sm text-stone-500">No calls yet.</li>
          ) : (
            todayCalls.slice(0, 20).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-stone-100 px-3 py-2 text-sm"
              >
                <span className="text-stone-600">
                  {new Date(c.timestamp).toLocaleTimeString()} — {c.call_id.slice(0, 8)}
                </span>
                <span className="flex gap-2">
                  {c.high_priority && <span className="rounded bg-red-100 px-1.5 text-red-700">Urgent</span>}
                  {c.flagged && <span className="rounded bg-amber-100 px-1.5 text-amber-700">Flagged</span>}
                  {c.confidence != null && <span>{Math.round((c.confidence ?? 0) * 100)}%</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="hidden rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-700">Usage logs</h2>
        <p className="mt-1 text-xs text-stone-500">{usageLogs.length} usage entries</p>
        <pre className="mt-3 max-h-56 overflow-auto rounded border border-stone-100 bg-stone-50 p-2 text-xs">
          {JSON.stringify(usageLogs, null, 2)}
        </pre>
      </section>

      <section className="hidden rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-700">Messages</h2>
        <p className="mt-1 text-xs text-stone-500">{messages.length} messages</p>
        <pre className="mt-3 max-h-56 overflow-auto rounded border border-stone-100 bg-stone-50 p-2 text-xs">
          {JSON.stringify(messages, null, 2)}
        </pre>
      </section>

      <section>
        <button
          onClick={downloadLogs}
          className="rounded border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Download today&apos;s logs (CSV)
        </button>
      </section>
    </div>
  );
}
