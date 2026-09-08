'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuthToken } from '@/hooks/use-authorization';
import TableCheckout from '@/app/shared/venue/table-checkout';
type Booking = { _id: string; guest: { name: string; phone: string }; partySize: number; bookingAt: string; status: string; tableLabel?: string };
const transitions: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['checked_in', 'cancelled', 'no_show'], checked_in: ['completed'] };
export default function BookingsPage() {
  const token = useAuthToken();
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = useCallback(async (path: string, method = 'GET', body?: object) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/bookings${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
    });
    const result = await response.json() as { message?: string; data: Booking[] };
    if (!response.ok) throw new Error(result.message || 'Unable to load bookings');
    return result.data;
  }, [token]);
  const refresh = useCallback(async () => setRows(await request(`?status=${encodeURIComponent(status)}`)), [request, status]);
  useEffect(() => { if (token) void refresh().catch(e => setError(e instanceof Error ? e.message : 'Unable to load bookings')); }, [token, refresh]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Venue bookings</h1>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
      void run(async () => { await request('', 'POST', { guest: { name: data.get('name'), phone: data.get('phone') },
        partySize: Number(data.get('partySize')), bookingAt: new Date(String(data.get('bookingAt'))).toISOString(),
        tableLabel: data.get('tableLabel'), source: 'admin' }); form.reset(); });
    }}>
      <input className="rounded border p-2" name="name" aria-label="Guest name" placeholder="Guest name" required />
      <input className="rounded border p-2" name="phone" aria-label="Guest phone" placeholder="Phone" required />
      <input className="rounded border p-2" name="partySize" aria-label="Party size" type="number" min={1} max={100} defaultValue={2} required />
      <input className="rounded border p-2" name="bookingAt" aria-label="Booking date and time" type="datetime-local" required />
      <input className="rounded border p-2" name="tableLabel" aria-label="Table" placeholder="Table (optional)" />
      <button disabled={busy} className="rounded bg-gray-900 px-4 text-white">Create booking</button>
    </form>
    <label>Status <select className="rounded border p-2" value={status} onChange={e => setStatus(e.target.value)}>
      <option value="">All</option>{['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(s => <option key={s}>{s}</option>)}
    </select></label>
    <ul className="space-y-3">{rows.map(row => <li className="rounded border p-4" key={row._id}>
      <strong>{row.guest.name}</strong> · {row.guest.phone} · {row.partySize} guests
      <p>{new Date(row.bookingAt).toLocaleString()} · {row.tableLabel || 'Table unassigned'} · {row.status}</p>
      <div className="mt-3 flex gap-4">{(transitions[row.status] || []).map(to => <button className="underline" disabled={busy} key={to}
        onClick={() => void run(async () => { await request(`/${row._id}/status`, 'PATCH', { to }); })}>{to.replaceAll('_', ' ')}</button>)}</div>
      {row.status === 'checked_in' && token && <TableCheckout bookingId={row._id} token={token} />}
    </li>)}</ul>
    {!rows.length && <p>No bookings match this filter.</p>}
  </section>;
}
