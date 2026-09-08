'use client';
import { useEffect, useState } from 'react';
type Item = { _id: string; name: string; price: number };
export default function TableCheckout({ bookingId, token }: { bookingId: string; token: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  useEffect(() => { void fetch(`${API}/api/bookings/menu`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async response => { if (!response.ok) throw new Error('Unable to load menu'); setItems((await response.json() as { data: Item[] }).data); })
    .catch(e => setMessage(e instanceof Error ? e.message : 'Unable to load menu')); }, [API, token]);
  return <div className="mt-4 space-y-3 border-t pt-4">
    <p>Table-service bill · 9% commission. Menu prices include the commission.</p>
    {message && <p role="status">{message}</p>}
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); const data = new FormData(e.currentTarget); setBusy(true); setMessage('');
      const selected = items.map(item => ({ sizeId: item._id, quantity: Number(data.get(item._id)) })).filter(item => item.quantity > 0);
      try {
        const response = await fetch(`${API}/api/bookings/${bookingId}/checkout`, { method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: selected, email: data.get('email'), ageVerified: data.get('age') === 'on' }) });
        const result = await response.json() as { message?: string; data: { authorizationUrl: string } };
        if (!response.ok) throw new Error(result.message || 'Checkout failed');
        window.location.assign(result.data.authorizationUrl);
      } catch (e) { setMessage(e instanceof Error ? e.message : 'Checkout failed'); }
      finally { setBusy(false); }
    }}>
      {items.map(item => <label className="flex items-center justify-between gap-4" key={item._id}>
        {item.name} · ₦{item.price.toLocaleString()}
        <input className="w-20 rounded border p-2" type="number" name={item._id} min={0} max={100} defaultValue={0} aria-label={`Quantity for ${item.name}`} />
      </label>)}
      <input name="email" type="email" required aria-label="Customer receipt email" placeholder="Customer email" className="rounded border p-2" />
      <label className="block"><input name="age" type="checkbox" required /> Guest meets the legal drinking age</label>
      <button className="rounded bg-gray-900 px-4 py-2 text-white" disabled={busy || !items.length}>Open secure checkout</button>
    </form>
    <button className="underline" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const response = await fetch(`${API}/api/bookings/${bookingId}/reconcile-payment`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json() as { message?: string };
        if (!response.ok) throw new Error(result.message || 'Payment not confirmed');
        setMessage('Payment confirmed and recorded.');
      } catch (e) { setMessage(e instanceof Error ? e.message : 'Payment not confirmed'); }
      finally { setBusy(false); }
    }}>Check payment</button>
  </div>;
}
