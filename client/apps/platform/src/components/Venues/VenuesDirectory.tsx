'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Venue = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  city?: string;
  logo?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function formatCity(city?: string) { return city?.trim() || 'Nigeria'; }
function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function defaultBookingDate() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0);
  return date.toISOString().slice(0, 16);
}

function VenueCard({ venue, onSuccess }: { venue: Venue; onSuccess: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [bookingAt, setBookingAt] = useState(defaultBookingDate);

  async function requestBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetchWithAuth(`${API}/api/venues/${encodeURIComponent(venue.slug)}/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest: { name: form.get('name'), phone: form.get('phone') }, partySize: Number(form.get('partySize')), bookingAt: new Date(String(form.get('bookingAt'))).toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'We could not send that request.');
      onSuccess(`Request sent to ${venue.name}. We’ll let you know when the venue confirms.`);
      setOpen(false); formElement.reset(); setBookingAt(defaultBookingDate());
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'We could not send that request.'); }
    finally { setBusy(false); }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_18px_45px_rgba(67,32,18,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(67,32,18,0.13)]">
      <div className="relative flex min-h-48 items-end overflow-hidden bg-[#29151b] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(226,153,93,0.5),transparent_31%),radial-gradient(circle_at_90%_10%,rgba(126,33,45,0.75),transparent_35%),linear-gradient(135deg,#29151b_0%,#4a1f25_100%)]" />
        <div className="absolute -right-8 -top-14 h-48 w-48 rounded-full border border-white/10" /><div className="absolute -right-1 -top-7 h-36 w-36 rounded-full border border-white/10" />
        <div className="relative flex w-full items-end justify-between gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-xl font-extrabold tracking-wide text-amber-100 backdrop-blur-sm">{venue.logo ? <Image src={venue.logo} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" /> : initials(venue.name)}</div>
          <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">Venue tier</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-start justify-between gap-4"><div><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-red-700"><Icon.PiMapPinFill size={13} /> {formatCity(venue.city)}</p><h2 className="font-[var(--font-kavoon)] text-2xl font-normal tracking-tight text-stone-900">{venue.name}</h2></div><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Icon.PiWineFill size={18} /></span></div>
        <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-stone-500">{venue.description || 'A DrinksHarbour venue for good pours, late nights, and memorable company.'}</p>
        <div className="mt-6 border-t border-stone-100 pt-4">
          {!open ? <button type="button" aria-expanded={open} onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2">Request a table <Icon.PiArrowUpRight size={18} /></button> : (
            <form className="space-y-3" onSubmit={requestBooking}>
              <div className="flex items-center justify-between"><p className="text-sm font-bold text-stone-900">Tell us about your visit</p><button type="button" onClick={() => setOpen(false)} aria-label="Close booking form" className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Icon.PiX size={18} /></button></div>
              <input name="name" aria-label="Your name" placeholder="Your name" required className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" />
              <input name="phone" aria-label="Phone number" placeholder="Phone number" type="tel" required className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" />
              <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-stone-500">Guests<input name="partySize" aria-label="Number of guests" type="number" min={1} max={100} defaultValue={2} required className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" /></label><label className="text-xs font-semibold text-stone-500">Date & time<input name="bookingAt" aria-label="Date and time" type="datetime-local" min={defaultBookingDate()} value={bookingAt} onChange={(event) => setBookingAt(event.target.value)} required className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-stone-900 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" /></label></div>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
              <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-700 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><Icon.PiSpinnerGap className="animate-spin" size={17} /> Sending request…</> : <>Send request <Icon.PiArrowRight size={17} /></>}</button>
              <p className="text-center text-[11px] leading-4 text-stone-400">You’ll be asked to sign in before your request is sent.</p>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

export default function VenuesDirectory() {
  const [venues, setVenues] = useState<Venue[]>([]); const [query, setQuery] = useState(''); const [city, setCity] = useState('All cities');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function loadVenues() { setStatus('loading'); setError(''); try { const response = await fetch(`${API}/api/venues`); if (!response.ok) throw new Error('Venues are taking a moment to load.'); const result = await response.json(); setVenues(Array.isArray(result.data) ? result.data : []); setStatus('ready'); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Venues are taking a moment to load.'); setStatus('error'); } }
  useEffect(() => { void loadVenues(); }, []);
  const cities = useMemo(() => ['All cities', ...Array.from(new Set(venues.map((venue) => formatCity(venue.city)))).sort()], [venues]);
  const filteredVenues = useMemo(() => venues.filter((venue) => { const haystack = `${venue.name} ${venue.description || ''} ${formatCity(venue.city)}`.toLowerCase(); return haystack.includes(query.toLowerCase().trim()) && (city === 'All cities' || formatCity(venue.city) === city); }), [city, query, venues]);

  return (
    <main className="min-h-screen bg-[#fbf8f4] pb-20 text-stone-900">
      <section className="relative overflow-hidden bg-[#261419] text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(235,170,99,0.26),transparent_25%),radial-gradient(circle_at_10%_80%,rgba(142,35,47,0.48),transparent_38%)]" /><div className="relative mx-auto grid max-w-[1322px] gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-8 lg:pb-24 lg:pt-20"><div><p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-300"><span className="h-px w-8 bg-amber-300" /> The DrinksHarbour social guide</p><h1 className="max-w-2xl font-[var(--font-kavoon)] text-5xl font-normal leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-7xl">Where the night <span className="text-amber-300">pours</span> into place.</h1><p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">Find Nigeria’s best clubs, lounges, and bar experiences. Choose your spot, tell us when you’re coming, and let the venue take it from there.</p></div><div className="relative hidden min-h-52 lg:block"><div className="absolute bottom-0 right-8 h-64 w-64 rounded-full border border-amber-300/25" /><div className="absolute bottom-8 right-16 h-48 w-48 rounded-full border border-white/10" /><Icon.PiMartiniFill className="absolute bottom-12 right-28 rotate-[-15deg] text-amber-300/80" size={126} /><span className="absolute bottom-2 right-0 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-sm">Good nights start here</span></div></div></section>
      <section className="relative z-10 mx-auto -mt-8 max-w-[1100px] px-4 sm:px-6"><div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_18px_45px_rgba(67,32,18,0.1)] sm:grid-cols-[1fr_auto]"><label className="flex min-h-12 items-center gap-3 rounded-xl bg-stone-50 px-4 text-stone-400 focus-within:ring-2 focus-within:ring-red-100"><Icon.PiMagnifyingGlass size={20} /><span className="sr-only">Search venues</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by venue or city" className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none" /></label><div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">{cities.map((option) => <button key={option} type="button" onClick={() => setCity(option)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${city === option ? 'bg-stone-950 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}>{option}</button>)}</div></div></section>
      <section className="mx-auto max-w-[1100px] px-4 pt-14 sm:px-6"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-700">Tonight’s shortlist</p><h2 className="font-[var(--font-kavoon)] text-3xl font-normal tracking-tight sm:text-4xl">Find your next table</h2></div><p className="text-sm font-medium text-stone-400">{filteredVenues.length} {filteredVenues.length === 1 ? 'venue' : 'venues'} available</p></div>
        {notice && <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"><Icon.PiCheckCircleFill size={19} /> {notice}<button type="button" onClick={() => setNotice('')} className="ml-auto text-green-700" aria-label="Dismiss notification"><Icon.PiX size={16} /></button></div>}
        {status === 'loading' && <div className="grid gap-6 md:grid-cols-2"><div className="h-[27rem] animate-pulse rounded-[1.75rem] bg-stone-200" /><div className="hidden h-[27rem] animate-pulse rounded-[1.75rem] bg-stone-200 md:block" /></div>}
        {status === 'error' && <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center"><Icon.PiWarningCircle className="mx-auto mb-3 text-red-700" size={32} /><h2 className="text-lg font-bold text-stone-900">We couldn’t load the venue list</h2><p className="mt-2 text-sm text-stone-500">{error}</p><button type="button" onClick={() => void loadVenues()} className="mt-5 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800">Try again</button></div>}
        {status === 'ready' && filteredVenues.length > 0 && <div className="grid gap-6 md:grid-cols-2">{filteredVenues.map((venue) => <VenueCard key={venue._id} venue={venue} onSuccess={setNotice} />)}</div>}
        {status === 'ready' && filteredVenues.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><Icon.PiMagnifyingGlass className="mx-auto mb-3 text-stone-300" size={34} /><h2 className="text-lg font-bold text-stone-900">No venues match that search</h2><p className="mt-2 text-sm text-stone-500">Try another city or clear your search to see the full directory.</p><button type="button" onClick={() => { setQuery(''); setCity('All cities'); }} className="mt-5 font-bold text-red-700 hover:text-red-800">Clear filters</button></div>}
      </section>
      <section className="mx-auto mt-20 max-w-[1100px] px-4 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-700">Simple by design</p><h2 className="font-[var(--font-kavoon)] text-3xl font-normal tracking-tight sm:text-4xl">Your night, arranged.</h2></div><Icon.PiPaperPlaneTilt className="hidden text-amber-500 sm:block" size={34} /></div>
        <div className="grid overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white md:grid-cols-3">
          <div className="border-b border-stone-200 p-6 md:border-b-0 md:border-r"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Icon.PiCompass size={21} /></div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">01 / Discover</p><h3 className="text-lg font-bold text-stone-900">Choose your room</h3><p className="mt-2 text-sm leading-6 text-stone-500">Search the directory and narrow it down by city.</p></div>
          <div className="border-b border-stone-200 p-6 md:border-b-0 md:border-r"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Icon.PiCalendarCheck size={21} /></div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">02 / Request</p><h3 className="text-lg font-bold text-stone-900">Set the details</h3><p className="mt-2 text-sm leading-6 text-stone-500">Tell the venue when you’re coming and how many are joining.</p></div>
          <div className="p-6"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-700"><Icon.PiConfetti size={21} /></div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">03 / Enjoy</p><h3 className="text-lg font-bold text-stone-900">Wait for confirmation</h3><p className="mt-2 text-sm leading-6 text-stone-500">The venue confirms availability, then your evening is yours.</p></div>
        </div>
      </section>
      <section className="mx-auto mt-14 max-w-[1100px] px-4 sm:px-6"><div className="grid gap-4 rounded-[1.75rem] bg-[#29151b] p-7 text-white sm:grid-cols-3 sm:p-9"><div className="sm:col-span-2"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Planning something special?</p><h2 className="font-[var(--font-kavoon)] text-2xl font-normal sm:text-3xl">Make the table part of the occasion.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/60">Explore premium bottles and mixers before you arrive, then let your venue handle the rest.</p></div><div className="flex items-end sm:justify-end"><Link href="/shop" className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-[#29151b] transition hover:bg-amber-200">Shop the bar <Icon.PiArrowUpRight size={17} /></Link></div></div></section>
    </main>
  );
}
