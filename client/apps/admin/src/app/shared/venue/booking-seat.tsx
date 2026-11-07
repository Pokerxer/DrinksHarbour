'use client';
import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { requestKey, venueRequest } from '@/services/venue/api';
import { buttonClass, fieldClass, Notice, primaryButtonClass } from './workspace/controls';

type Table = { id: string; name: string; version: number };
type Location = { id: string; name: string; canonicalCheckoutEnabled: boolean; tables: Table[]; actions: Record<string, boolean> };

export default function BookingSeat({ token, bookingId, onSeated }: { token: string; bookingId: string; onSeated: () => Promise<void> }) {
  const [locations, setLocations] = useState<Location[]>([]); const [identity, setIdentity] = useState(0);
  const [locationId, setLocationId] = useState(''); const [tableId, setTableId] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void venueRequest<{ identityVersion: number; locations: Location[] }>(token, '/readiness').then(result => { setLocations(result.locations); setIdentity(result.identityVersion); }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load venue')); }, [token]);
  const location = locations.find(row => row.id === locationId); const table = location?.tables.find(row => row.id === tableId);
  return <div className="my-3 flex flex-wrap items-end gap-3">
    {error && (
      <Notice tone="error" role="alert">
        {error}
      </Notice>
    )}
    {identity === 1 && <>
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="booking-seat-location">Venue location</label>
        <select id="booking-seat-location" aria-label="Venue location" className={`${fieldClass} w-auto`} value={locationId} onChange={e => { setLocationId(e.target.value); setTableId(''); }}>
          <option value="">Choose location</option>{locations.filter(row => row.actions['session.create']).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="booking-seat-table">Available table</label>
        <select id="booking-seat-table" aria-label="Available table" className={`${fieldClass} w-auto`} value={tableId} onChange={e => setTableId(e.target.value)}>
          <option value="">Choose table</option>{location?.tables.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </div>
    </>}
    <button className={primaryButtonClass} disabled={busy || (identity === 1 && !table)} onClick={async () => {
      setBusy(true); setError('');
      const body = { to: 'checked_in', ...(identity === 1 && table ? { locationId, tableIds: [table.id], expectedTableVersions: [table.version] } : {}) };
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/bookings/${bookingId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': await requestKey(JSON.stringify([token, bookingId, body])) }, body: JSON.stringify(body) });
        const result = await response.json() as { message?: string };
        if (!response.ok) throw new Error(result.message || 'Unable to seat booking');
        await onSeated();
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to seat booking'); } finally { setBusy(false); }
    }}>
      <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
      Check in
    </button>
  </div>;
}
