'use client';
import React, { useEffect, useState } from 'react';
import { posApi } from '../api';
import POSLocationSelect from './pos-location-select';

export default function RetailLocationSettings({ token }: { token: string }) {
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    posApi.getPOSSettings(token).then(({ posSettings }) => {
      if (!cancelled) setLocation(posSettings.retailWarehouse || '');
    }).catch(() => { if (!cancelled) setMessage('Unable to load Retail settings.'); });
    return () => { cancelled = true; };
  }, [token]);
  async function save() {
    if (!location || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await posApi.updateShop(token, 'retail', { warehouse: location });
      setMessage('Retail stock location saved. Reopen the POS to refresh its products.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save location.');
    } finally { setBusy(false); }
  }
  return <div className="space-y-3 px-6 py-3">
    <p className="text-sm font-semibold">Retail — default POS</p>
    <fieldset disabled={busy}>
      <POSLocationSelect token={token} value={location} onChange={setLocation} />
    </fieldset>
    {!location && <p className="text-xs text-gray-500">Until selected, Retail uses the default stock location.</p>}
    <button type="button" disabled={!location || busy} onClick={save}
      className="rounded-lg bg-[#b20202] px-3 py-2 text-sm text-white disabled:opacity-50">
      {busy ? 'Saving…' : 'Save Retail location'}
    </button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
