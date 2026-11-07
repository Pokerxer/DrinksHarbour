import Link from 'next/link';
import { PiArrowUpRight, PiMapPin, PiWine } from 'react-icons/pi';
import OptimizedImage from '@/components/UI/OptimizedImage';
import { assertVenueHost, publicVenueGet } from '@/lib/venue/server';
import { locationPath, type VenueLocation } from '@/lib/venue/types';

export default async function VenueDirectory({ query }: { query: Record<string, string | undefined> }) {
  const host = await assertVenueHost();
  const params = new URLSearchParams();
  for (const key of ['city', 'type', 'after']) if (query[key]) params.set(key, query[key]!);
  if (host) params.set('slug', host);
  const page = await publicVenueGet<{ items: VenueLocation[]; next: string | null }>(`?${params}`);
  const more = new URLSearchParams(params);
  if (page.next) more.set('after', page.next);
  const field = 'mt-2 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-100';
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2';
  return (
    <main className="bg-stone-50 pb-16 text-stone-900">
      <header className="bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">The DrinksHarbour venue guide</p>
          <h1 className="max-w-3xl font-[var(--font-kavoon)] text-4xl font-normal leading-tight sm:text-5xl">Find your next table.</h1>
          <p className="mt-5 max-w-xl leading-7 text-stone-300">Explore restaurants, bars, lounges and clubs. Review the location, browse the drinks menu and send your table request.</p>
          <p className="mt-4 text-sm font-medium text-amber-200">Your table is confirmed when the venue accepts your request.</p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6">
        <form className="grid items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]" aria-label="Filter venues">
          <label className="text-sm font-semibold">City<input name="city" placeholder="For example, Abuja" autoComplete="address-level2" defaultValue={query.city} className={field} /></label>
          <label className="text-sm font-semibold">Venue type<select name="type" defaultValue={query.type || ''} className={field}>
            <option value="">All venue types</option>
            {['restaurant', 'bar', 'lounge', 'club'].map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
          </select></label>
          <button className={`min-h-12 rounded-xl bg-red-800 px-6 py-3 font-semibold text-white transition hover:bg-red-900 ${focus}`}>Find venues</button>
          <Link href="/venues" className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-stone-600 underline underline-offset-4 hover:text-red-800 ${focus}`}>Clear filters</Link>
        </form>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">{query.city ? `Venues in ${query.city}` : 'Explore locations'}</h2>
          <p className="text-sm text-stone-600">{page.items.length} {page.items.length === 1 ? 'location' : 'locations'} on this page</p>
        </div>
        {!page.items.length && <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"><PiMapPin className="mx-auto mb-4 text-stone-500" size={32} aria-hidden="true" /><h3 className="text-xl font-semibold">No locations match these filters</h3><p className="mx-auto mt-3 max-w-md leading-7 text-stone-600">Try a nearby city or choose another venue type. Clear filters to explore all published locations.</p><Link href="/venues" className={`mt-5 inline-flex min-h-11 items-center rounded-xl bg-red-800 px-5 py-3 font-semibold text-white ${focus}`}>Explore all venues</Link></div>}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map(venue => <article key={venue.locationId} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="relative aspect-[3/2] overflow-hidden bg-stone-900">
              {venue.photos?.[0] ? <OptimizedImage src={venue.photos[0].url} alt={venue.photos[0].alt || venue.name} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-amber-100"><PiWine size={44} aria-hidden="true" /><span className="text-sm font-medium">{venue.tenant.name}</span></div>}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-red-800">{venue.types.join(' · ')}</p>
              <h3 className="mt-3 text-xl font-semibold"><Link href={locationPath(venue)} className={`rounded ${focus}`}>{venue.name}</Link></h3>
              <p className="mt-2 flex gap-2 text-sm leading-6 text-stone-600"><PiMapPin size={18} className="mt-1 shrink-0" aria-hidden="true" />{venue.address || venue.tenant.city}</p>
              <p className="mb-6 mt-3 line-clamp-3 text-sm leading-6 text-stone-600">{venue.description}</p>
              <Link className={`mt-auto inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold transition hover:border-red-800 hover:text-red-800 ${focus}`} href={locationPath(venue)} aria-label={`View ${venue.name} location and menu`}>View location and menu<PiArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </article>)}
        </div>
        {page.next && <nav aria-label="More venue results"><Link href={`/venues?${more}`} className={`inline-flex min-h-12 items-center rounded-xl border border-stone-300 bg-white px-5 py-3 font-semibold hover:bg-stone-100 ${focus}`}>Next venues →</Link></nav>}
      </div>
    </main>
  );
}
