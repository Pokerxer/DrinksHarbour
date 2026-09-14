'use client';
import { useState } from 'react';
import { posApi } from '../api';
import type { POSSession } from '../types';
export function LegacySessionClose({ session, token, onClosed }: { session: POSSession; token: string; onClosed: () => void }) {
  const [counted, setCounted] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session.shopId || session.status !== 'open') return null;
  async function close() {
    if (!Number.isFinite(Number(counted)) || Number(counted) < 0 || counted === '') { setError('Enter the cash counted in the legacy drawer.'); return; }
    setBusy(true); setError('');
    try {
      await posApi.closeLegacySession(token, session._id, Number(counted));
      onClosed();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not close session'); }
    finally { setBusy(false); }
  }
  return <div className="border-b border-amber-200 bg-amber-50 p-4 text-sm">
    <p className="mb-2">This older session has no confirmed shop. Count its drawer before opening new shop sessions. Its history will remain in Legacy.</p>
    <label>Counted cash (₦) <input aria-label="Legacy counted cash" type="number" min="0" step="0.01" value={counted} onChange={e => setCounted(e.target.value)} className="rounded border p-2" /></label>
    <button disabled={busy} onClick={close} className="ml-2 rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50">{busy ? 'Closing…' : 'Close legacy session'}</button>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </div>;
}
