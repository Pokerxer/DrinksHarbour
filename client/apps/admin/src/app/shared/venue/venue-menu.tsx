'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { getBill } from '@/services/venue/api';
import { combineVenueQuantities, editableVenueLines, saveCheckoutLines } from '@/services/venue/checkout-lines';
import type { VenueBill } from '@/services/venue/types';
import VenueCheckout from './venue-checkout';
import { buttonClass, fieldClass, Notice, panelClass } from './workspace/controls';

type MenuItem = { _id: string; subProductId: string; name: string; price: number };

const money = (minor: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(minor / 100);

export default function VenueMenu({ token, sessionId }: { token: string; sessionId: string }) {
  const [items, setItems] = useState<MenuItem[]>([]); const [error, setError] = useState(''); const [version, setVersion] = useState<number>();
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [state, setState] = useState(''); const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(new Set<string>());
  const applyBill = useCallback((bill: VenueBill) => { setVersion(bill.version); setState(bill.state); }, []);
  const reload = useCallback(async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/bookings/menu`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load menu');
    const result = await response.json() as { data: MenuItem[] };
    const bill = await getBill(token, sessionId);
    setItems(result.data); applyBill(bill);
    const saved: Record<string, number> = {};
    for (const line of bill.lines) saved[line.sizeId] = (saved[line.sizeId] || 0) + line.quantity;
    setQuantities(previous => ({ ...saved, ...Object.fromEntries(Array.from(dirty.current).filter(id => previous[id] !== undefined).map(id => [id, previous[id]])) }));
  }, [token, sessionId, applyBill]);
  useEffect(() => { dirty.current.clear(); void reload().catch(e => setError(e instanceof Error ? e.message : 'Unable to load venue')); }, [reload]);
  const reloadStatus = useCallback(async () => {
    setBusy(true); setError('');
    try { await reload(); setRevision(value => value + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to reload venue'); }
    finally { setBusy(false); }
  }, [reload]);
  return <div className="space-y-4">
    {error && (
      <Notice
        tone="error"
        role="alert"
        action={
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void reloadStatus()}>
            Reload menu and bill
          </button>
        }
      >
        {error}
      </Notice>
    )}
    {state === 'open' && <div className={`${panelClass} space-y-2`}>
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Menu items · adjust quantities before freezing the bill</h3>
      {items.map(item => (
        <div key={item._id} className="flex items-center justify-between gap-4 border-b border-muted py-2 last:border-b-0 dark:border-gray-700">
          <span className="text-sm font-medium">{item.name} · <span className="tabular-nums">{money(item.price * 100)}</span></span>
          <input
            aria-label={`Quantity for ${item.name}`}
            type="number"
            min={0}
            max={100}
            className={`${fieldClass} w-20`}
            value={quantities[item._id] || 0}
            onChange={e => { dirty.current.add(item._id); setQuantities({ ...quantities, [item._id]: Number(e.target.value) }); }}
          />
        </div>
      ))}
      {!items.length && <p className="text-sm text-gray-500 dark:text-gray-400">No beverages are listed on this menu. Served items stay on the bill.</p>}
    </div>}
    <VenueCheckout key={revision} token={token} sessionId={sessionId} onBillChange={applyBill} prepare={async () => {
      if (version === undefined) throw new Error('Load the menu before freezing this bill.');
      const old = await getBill(token, sessionId);
      const missing = editableVenueLines(old.lines.filter(line => !items.some(item => item._id === line.sizeId)));
      const lines = items.filter(item => quantities[item._id] > 0).map(item => ({ subProductId: item.subProductId, sizeId: item._id, quantity: quantities[item._id] }));
      const accepted = await saveCheckoutLines(token, sessionId, { expectedVersion: version, lines: [...lines, ...missing] });
      setVersion(accepted.version);
    }} />
    <button className={buttonClass} disabled={busy} onClick={() => void reloadStatus()}>
      <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
      Reload checkout status
    </button>
  </div>;
}
