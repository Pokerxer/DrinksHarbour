'use client';
import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import VenueMenu from './venue-menu';
import { buttonClass, fieldClass, panelClass, primaryButtonClass } from './workspace/controls';

type Item = { _id: string; name: string; price: number };

export default function TableCheckout(props: { bookingId: string; token: string; serviceSessionId?: string | { _id: string } }) {
  const sessionId = typeof props.serviceSessionId === 'string' ? props.serviceSessionId : props.serviceSessionId?._id;
  return sessionId ? <VenueMenu token={props.token} sessionId={sessionId} /> : <LegacyTableCheckout {...props} />;
}

function LegacyTableCheckout({ bookingId, token }: { bookingId: string; token: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  useEffect(() => {
    void fetch(`${API}/api/bookings/menu`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load menu');
        setItems((await response.json() as { data: Item[] }).data);
        setError('');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Unable to load menu'));
  }, [API, token]);
  return <div className={`${panelClass} mt-4 space-y-3`}>
    <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Table-service bill · 9% commission. Menu prices include the commission.</p>
    {!items.length && !error && <p role="status" className="rounded-lg border border-muted bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Loading table menu…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
    {status && <p role="status" className="rounded-lg border border-muted bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{status}</p>}
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); const data = new FormData(e.currentTarget); setBusy(true); setStatus(''); setError('');
      const selected = items.map(item => ({ sizeId: item._id, quantity: Number(data.get(item._id)) })).filter(item => item.quantity > 0);
      try {
        const response = await fetch(`${API}/api/bookings/${bookingId}/checkout`, { method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: selected, email: data.get('email'), ageVerified: data.get('age') === 'on' }) });
        const result = await response.json() as { message?: string; data: { authorizationUrl: string } };
        if (!response.ok) throw new Error(result.message || 'Checkout failed');
        window.location.assign(result.data.authorizationUrl);
      } catch (e) { setError(e instanceof Error ? e.message : 'Checkout failed'); }
      finally { setBusy(false); }
    }}>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item._id} className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{item.name} · <span className="tabular-nums">₦{item.price.toLocaleString()}</span></span>
            <input className={`${fieldClass} w-20`} type="number" name={item._id} min={0} max={100} defaultValue={0} aria-label={`Quantity for ${item.name}`} />
          </li>
        ))}
      </ul>
      <label className="block max-w-sm text-sm font-medium">
        Customer receipt email
        <input name="email" type="email" required className={fieldClass} />
      </label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"><input className="size-4 rounded border-gray-400" name="age" type="checkbox" required /> Guest meets the legal drinking age</label>
      <div>
        <button className={primaryButtonClass} disabled={busy || !items.length}>Open secure checkout</button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Checkout opens Paystack&rsquo;s secure page in this tab.</p>
    </form>
    <button className={buttonClass} disabled={busy} onClick={async () => {
      setBusy(true); setStatus(''); setError('');
      try {
        const response = await fetch(`${API}/api/bookings/${bookingId}/reconcile-payment`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json() as { message?: string };
        if (!response.ok) throw new Error(result.message || 'Payment not confirmed');
        setStatus('Payment confirmed and recorded.');
      } catch (e) { setError(e instanceof Error ? e.message : 'Payment not confirmed'); }
      finally { setBusy(false); }
    }}>
      <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
      Check payment
    </button>
  </div>;
}
