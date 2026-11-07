import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PiArrowUpRight, PiMapPin } from 'react-icons/pi';
import { assertVenueHost, publicVenueGet } from '@/lib/venue/server';
import { locationPath, type VenueLocation } from '@/lib/venue/types';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2';

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { slug } = await params;
  await assertVenueHost(slug);
  const page = await publicVenueGet<{
    items: VenueLocation[];
    next: string | null;
  }>(`/${encodeURIComponent(slug)}?${new URLSearchParams(await searchParams)}`);
  if (!page.items.length) notFound();
  const count = page.items.length;
  return (
    <main className="bg-stone-50 pb-16 text-stone-900">
      <header className="bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/venues"
            className={`mb-4 inline-block text-xs font-bold uppercase tracking-[0.2em] text-amber-200 underline-offset-4 hover:underline ${focus}`}
          >
            The DrinksHarbour venue guide
          </Link>
          <h1 className="max-w-3xl font-[var(--font-kavoon)] text-4xl font-normal leading-tight sm:text-5xl">
            {page.items[0].tenant.name}
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-stone-300">
            Choose a location to view its hours, drinks menu and request
            options.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Locations</h2>
          <p className="text-sm text-stone-600">
            {count} {count === 1 ? 'location' : 'locations'} on this page
          </p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((location) => (
            <li
              key={location.locationId}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-red-800">
                {location.types.join(' · ')}
              </p>
              <h3 className="mt-3 text-xl font-semibold">
                <Link href={locationPath(location)} className={`rounded ${focus}`}>
                  {location.name}
                </Link>
              </h3>
              <p className="mt-2 flex gap-2 text-sm leading-6 text-stone-600">
                <PiMapPin size={18} className="mt-1 shrink-0" aria-hidden="true" />
                {location.address}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Venue time: {location.timezone}
              </p>
              <Link
                href={locationPath(location)}
                aria-label={`Open ${location.name} hours, menu and table request`}
                className={`mt-auto inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold transition hover:border-red-800 hover:text-red-800 ${focus}`}
              >
                View location and menu
                <PiArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        {page.next && (
          <nav aria-label="More location results">
            <Link
              href={`/venues/${encodeURIComponent(slug)}?after=${encodeURIComponent(page.next)}`}
              aria-label="Advance to the next locations for this venue"
              className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 font-semibold transition hover:bg-stone-100 ${focus}`}
            >
              More locations
              <PiArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </nav>
        )}
      </div>
    </main>
  );
}
