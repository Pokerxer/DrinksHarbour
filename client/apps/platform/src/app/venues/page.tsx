'use client';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
type Venue = { _id: string; name: string; slug: string; description?: string };
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch(`${API}/api/venues`).then(async response => {
    if (!response.ok) throw new Error('Unable to load venues');
    setVenues((await response.json()).data);
  }).catch(e => setMessage(e.message)); }, []);
  return <main className="container mx-auto space-y-6 px-4 py-12">
    <h1 className="text-3xl font-semibold">Discover venues</h1>
    <p>Reserve a table at a DrinksHarbour venue. Sign in to send a booking request; the venue will confirm availability.</p>
    {message && <p role="status">{message}</p>}
    {venues.map(venue => <section key={venue._id} className="space-y-4 rounded border p-6">
      <h2 className="text-xl font-semibold">{venue.name}</h2><p>{venue.description}</p>
      <form className="flex flex-wrap gap-3" onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); setBusy(true);
        try {
          const response = await fetchWithAuth(`${API}/api/venues/${encodeURIComponent(venue.slug)}/bookings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guest: { name: data.get('name'), phone: data.get('phone') }, partySize: Number(data.get('partySize')),
              bookingAt: new Date(String(data.get('bookingAt'))).toISOString() }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Booking failed');
          setMessage(`Booking request ${result.data._id} sent to ${venue.name}. Awaiting confirmation.`); form.reset();
        } catch (err) { setMessage(err instanceof Error ? err.message : 'Booking failed'); }
        finally { setBusy(false); }
      }}>
        <input className="border p-2" name="name" aria-label="Guest name" placeholder="Your name" required />
        <input className="border p-2" name="phone" aria-label="Phone" placeholder="Phone" required />
        <input className="border p-2" name="partySize" aria-label="Party size" type="number" min={1} max={100} defaultValue={2} required />
        <input className="border p-2" name="bookingAt" aria-label="Date and time" type="datetime-local" required />
        <button disabled={busy} className="rounded bg-black px-4 text-white">Request table</button>
      </form>
    </section>)}
  </main>;
}
