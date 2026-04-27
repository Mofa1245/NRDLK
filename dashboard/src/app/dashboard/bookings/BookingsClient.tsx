'use client';

import { useEffect, useMemo, useState } from 'react';

type Booking = {
  id: string;
  call_id?: string | null;
  customer_phone: string;
  booking_date: string | null;
  booking_time: string | null;
  party_size: number | null;
  special_request: string | null;
  details_text: string | null;
  updated_by_staff?: boolean;
  status: 'pending_confirmation' | 'confirmed' | 'handoff' | 'contacted' | 'cancelled' | 'completed' | string;
  confirmed_at: string | null;
  corrected_by_customer: boolean;
  created_at: string;
};

function truncate(text: string, max = 90) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function BookingsClient({
  initialBookings,
  businessIdText,
}: {
  initialBookings: Booking[];
  businessIdText: string;
}) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [windowFilter, setWindowFilter] = useState<'today' | 'upcoming' | 'all'>('today');
  const [sortBy, setSortBy] = useState<'newest' | 'time'>('newest');
  const [queue, setQueue] = useState<'needs_action' | 'in_progress' | 'closed'>('needs_action');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ booking_date: string; booking_time: string; party_size: string; special_request: string }>({
    booking_date: '',
    booking_time: '',
    party_size: '',
    special_request: '',
  });
  const [inlineError, setInlineError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [flashNewUntil, setFlashNewUntil] = useState<Record<string, number>>({});

  useEffect(() => {
    const secTimer = setInterval(() => {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
      setFlashNewUntil((prev) => {
        const next: Record<string, number> = {};
        const now = Date.now();
        for (const [k, v] of Object.entries(prev)) {
          if (v > now) next[k] = v;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(secTimer);
  }, [lastUpdatedAt]);

  useEffect(() => {
    setBookings(initialBookings);
    setLastUpdatedAt(Date.now());
  }, [initialBookings]);

  useEffect(() => {
    if (!businessIdText) return;
    let cancelled = false;
    const poll = async () => {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/backend/api/bookings?business_id=${encodeURIComponent(businessIdText)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('poll failed');
        const json = (await res.json()) as { bookings?: Booking[] };
        const nextBookings = json.bookings || [];
        if (cancelled) return;
        const nowTs = Date.now();
        setBookings((prev) => {
          const existing = new Set(prev.map((b) => b.id));
          const newIds = nextBookings.filter((b) => !existing.has(b.id)).map((b) => b.id);
          if (newIds.length) {
            setFlashNewUntil((prevFlash) => {
              const next = { ...prevFlash };
              for (const id of newIds) next[id] = nowTs + 5000;
              return next;
            });
          }
          return nextBookings;
        });
        setLastUpdatedAt(nowTs);
        setSecondsSinceUpdate(0);
      } catch {
        if (!cancelled) setInlineError('Could not update booking');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };
    const timer = setInterval(() => {
      void poll();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [businessIdText]);

  function isNew(id: string, createdAt: string) {
    const now = Date.now();
    if ((flashNewUntil[id] || 0) > now) return true;
    return now - new Date(createdAt).getTime() <= 5 * 60 * 1000;
  }
  function isFlashing(id: string) {
    return (flashNewUntil[id] || 0) > Date.now();
  }

  function dateLabel(dateValue: string | null) {
    if (!dateValue) return '—';
    const today = new Date().toISOString().slice(0, 10);
    if (dateValue === today) return 'Today';
    return dateValue;
  }

  const visible = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let items = bookings.filter((b) => {
      if (windowFilter === 'all') return true;
      if (!b.booking_date) return false;
      if (windowFilter === 'today') return b.booking_date === today;
      return b.booking_date > today;
    });
    if (sortBy === 'newest') {
      items = [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else {
      items = [...items].sort((a, b) => String(a.booking_time || '').localeCompare(String(b.booking_time || '')));
    }
    return items;
  }, [bookings, windowFilter, sortBy]);

  async function updateStatus(id: string, status: Booking['status']) {
    setBusyId(id);
    setInlineError('');
    try {
      const res = await fetch(`/api/backend/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Status update failed');
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch {
      setInlineError('Could not update booking');
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(b: Booking) {
    setEditingId(b.id);
    setEditForm({
      booking_date: b.booking_date || '',
      booking_time: b.booking_time || '',
      party_size: b.party_size == null ? '' : String(b.party_size),
      special_request: b.special_request || '',
    });
    setInlineError('');
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/backend/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: editForm.booking_date || null,
          booking_time: editForm.booking_time || null,
          party_size: editForm.party_size ? Number(editForm.party_size) : null,
          special_request: editForm.special_request || null,
        }),
      });
      if (!res.ok) throw new Error('Edit failed');
      const json = (await res.json()) as { booking?: Booking };
      const updated = json.booking;
      if (updated) setBookings((prev) => prev.map((b) => (b.id === id ? (updated as Booking) : b)));
      setEditingId(null);
    } catch {
      setInlineError('Could not update booking');
    } finally {
      setBusyId(null);
    }
  }

  const needsAction = visible.filter((b) =>
    ['pending_confirmation', 'confirmed', 'handoff'].includes(String(b.status)),
  );
  const inProgress = visible.filter((b) => String(b.status) === 'contacted');
  const closed = visible.filter((b) => ['completed', 'cancelled'].includes(String(b.status)));
  const activeQueueItems =
    queue === 'needs_action' ? needsAction : queue === 'in_progress' ? inProgress : closed;
  const renderedQueueItems = [...activeQueueItems].sort((a, b) => {
    const aUrgent = a.status === 'handoff' ? 1 : 0;
    const bUrgent = b.status === 'handoff' ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    return +new Date(b.created_at) - +new Date(a.created_at);
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Last updated: {secondsSinceUpdate}s ago {refreshing ? '• Refreshing…' : ''}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setWindowFilter('today')} className="rounded border px-2 py-1">Today</button>
          <button onClick={() => setWindowFilter('upcoming')} className="rounded border px-2 py-1">Upcoming</button>
          <button onClick={() => setWindowFilter('all')} className="rounded border px-2 py-1">All</button>
          <button onClick={() => setSortBy(sortBy === 'newest' ? 'time' : 'newest')} className="rounded border px-2 py-1">
            Sort: {sortBy === 'newest' ? 'Newest' : 'Time'}
          </button>
        </div>
      </div>
      {inlineError ? <p className="mt-2 text-xs text-red-600">Could not update booking</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setQueue('needs_action')}
          className={`rounded border px-3 py-1 ${queue === 'needs_action' ? 'bg-slate-900 text-white' : ''}`}
        >
          Needs Action ({needsAction.length})
        </button>
        <button
          onClick={() => setQueue('in_progress')}
          className={`rounded border px-3 py-1 ${queue === 'in_progress' ? 'bg-slate-900 text-white' : ''}`}
        >
          In Progress ({inProgress.length})
        </button>
        <button
          onClick={() => setQueue('closed')}
          className={`rounded border px-3 py-1 ${queue === 'closed' ? 'bg-slate-900 text-white' : ''}`}
        >
          Closed ({closed.length})
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {renderedQueueItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
            No bookings yet.
            <br />
            Incoming calls will appear here.
          </div>
        ) : (
          <>
            <Section
              title={queue === 'needs_action' ? 'Needs Action' : queue === 'in_progress' ? 'In Progress' : 'Closed'}
              count={renderedQueueItems.length}
            />
            {renderedQueueItems.map((b) => (
              <div key={b.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <CardBody
                  b={b}
                  busyId={busyId}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  isNew={isNew}
                  isFlashing={isFlashing}
                  dateLabel={dateLabel}
                  updateStatus={updateStatus}
                  startEdit={startEdit}
                  saveEdit={saveEdit}
                  cancelEdit={() => setEditingId(null)}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function Section({ title, count }: { title: string; count: number }) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <h2 className="text-sm font-medium text-slate-700">{title}</h2>
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span>
    </div>
  );
}

function CardBody({
  b,
  busyId,
  editingId,
  editForm,
  setEditForm,
  isNew,
  isFlashing,
  dateLabel,
  updateStatus,
  startEdit,
  saveEdit,
  cancelEdit,
}: {
  b: Booking;
  busyId: string | null;
  editingId: string | null;
  editForm: { booking_date: string; booking_time: string; party_size: string; special_request: string };
  setEditForm: (updater: (prev: { booking_date: string; booking_time: string; party_size: string; special_request: string }) => { booking_date: string; booking_time: string; party_size: string; special_request: string }) => void;
  isNew: (id: string, createdAt: string) => boolean;
  isFlashing: (id: string) => boolean;
  dateLabel: (dateValue: string | null) => string;
  updateStatus: (id: string, status: Booking['status']) => Promise<void>;
  startEdit: (b: Booking) => void;
  saveEdit: (id: string) => Promise<void>;
  cancelEdit: () => void;
}) {
  const isUrgent = String(b.status) === 'handoff';
  return (
    <>
      <div
        className={`rounded-lg border p-4 shadow-sm transition-colors ${
          isUrgent ? 'border-red-200 bg-red-50/40' : isFlashing(b.id) ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-base text-slate-800">
            👤 {b.party_size ?? '—'} people &nbsp;|&nbsp; 🕒 {b.booking_time || '—'} &nbsp;|&nbsp; 📅 {dateLabel(b.booking_date)}
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            {isNew(b.id, b.created_at) ? (
              <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800">NEW</span>
            ) : null}
            {isUrgent ? (
              <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-800">URGENT</span>
            ) : null}
            {b.corrected_by_customer ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">Corrected</span>
            ) : null}
            {b.updated_by_staff ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">Updated by staff</span>
            ) : null}
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-700">📞 {b.customer_phone}</div>
        <div className="mt-2 text-sm text-slate-700">
          📝 {truncate((b.special_request || '').trim() || (isUrgent ? 'Customer requested human support' : '—'))}
        </div>
        {isUrgent ? (
          <div className="mt-2 text-xs font-medium text-red-700">Customer requested human support</div>
        ) : null}
        {b.details_text ? (
          <div className="mt-2 text-sm text-slate-600">Details: {truncate(b.details_text, 180)}</div>
        ) : null}
        {editingId === b.id ? (
                <div className="mt-3 grid gap-2 rounded border bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500">Date (YYYY-MM-DD)</span>
                    <input value={editForm.booking_date} onChange={(e) => setEditForm((p) => ({ ...p, booking_date: e.target.value }))} className="rounded border px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500">Time</span>
                    <input value={editForm.booking_time} onChange={(e) => setEditForm((p) => ({ ...p, booking_time: e.target.value }))} className="rounded border px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500">Party size</span>
                    <input value={editForm.party_size} onChange={(e) => setEditForm((p) => ({ ...p, party_size: e.target.value }))} className="rounded border px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-slate-500">Special request</span>
                    <input value={editForm.special_request} onChange={(e) => setEditForm((p) => ({ ...p, special_request: e.target.value }))} className="rounded border px-2 py-1" />
                  </label>
                  <div className="sm:col-span-2 flex gap-2">
                    <button disabled={busyId === b.id} onClick={() => void saveEdit(b.id)} className="rounded border px-2 py-1">Save Edit</button>
                    <button disabled={busyId === b.id} onClick={cancelEdit} className="rounded border px-2 py-1">Cancel</button>
                  </div>
                </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busyId === b.id} onClick={() => updateStatus(b.id, 'contacted')} className="rounded border px-2 py-1 text-xs">Mark Contacted</button>
          <button disabled={busyId === b.id} onClick={() => updateStatus(b.id, 'completed')} className="rounded border px-2 py-1 text-xs">Mark Completed</button>
          <button disabled={busyId === b.id} onClick={() => updateStatus(b.id, 'cancelled')} className="rounded border px-2 py-1 text-xs">Mark Cancelled</button>
          <button disabled={busyId === b.id} onClick={() => startEdit(b)} className="rounded border px-2 py-1 text-xs">Edit Booking</button>
        </div>
      </div>
    </>
  );
}
