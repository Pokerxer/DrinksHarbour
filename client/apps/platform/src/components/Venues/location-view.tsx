import Link from 'next/link';
import CategoryMenu from './category-menu';
import Image from '@/components/UI/OptimizedImage';
import { PiBasketBold, PiMapPin, PiPhone } from 'react-icons/pi';
import EventOccurrences from '@/components/Venues/event-occurrences';
import type { VenueLocation } from '@/lib/venue/types';
import { locationPath } from '@/lib/venue/types';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2';

export function VenueMenu({ venue }: { venue: VenueLocation }) {
  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6" id="beverage-menu">
      <h2 className="text-2xl font-bold">{venue.menu?.schemaVersion===2?'Food & drinks menu':'Beverage menu'}</h2>
      <p className="max-w-2xl leading-7 text-stone-600">
        Prices are in Naira. Stock availability can change; service hours apply.
        Ordering and payment happen with venue staff.
      </p>
      {!venue.menu?.sections.length && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center text-stone-600">
          The venue has not published a food and drinks menu yet. Contact the venue to
          learn what is stocked.
        </p>
      )}
      {venue.menu?.sections.map((section) => (
        <section key={section.id}>
          <h3 className="mb-3 text-xl font-semibold">{section.name}</h3>
          <ul className="grid gap-4 sm:grid-cols-2">
            {venue.menu?.schemaVersion === 2 ? <li className="sm:col-span-2"><CategoryMenu section={section} categories={venue.menu.categories||[]}/></li> : section.items.map((item) => (
              <li
                className={`space-y-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${item.available ? '' : 'border-dashed'}`}
                key={`${item.subProductId}:${item.sizeId}`}
              >
                <h4 className="font-semibold">
                  {item.name} · {item.sizeLabel}
                </h4>
                <p className="text-lg font-semibold tabular-nums text-stone-900">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: 'NGN',
                  }).format((item.unitPriceMinor + item.taxMinor) / 100)}{' '}
                  <span className="block text-xs font-normal text-stone-600">including configured tax</span>
                </p>
                <p className={`text-sm font-medium ${item.available ? 'text-green-800' : 'text-stone-600'}`}>
                  {item.available
                    ? 'Stock available at this location'
                    : 'Currently unavailable'}
                </p>
                {item.alcoholic && (
                  <p className="text-sm leading-6 text-stone-600">Alcohol · {item.abv}% ABV · age verification required</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
export default function LocationView({
  venue,
  menuOnly = false,
}: {
  venue: VenueLocation;
  menuOnly?: boolean;
}) {
  const path = locationPath(venue);
  return (
    <main className="container mx-auto max-w-5xl space-y-8 px-4 py-8 text-stone-900 sm:px-6 sm:py-12">
      <nav aria-label="Venue navigation" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-stone-200 pb-4 text-sm font-semibold text-stone-600 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-lg [&_a]:px-2 [&_a:hover]:text-red-800 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-red-800 [&_a:focus-visible]:ring-offset-2">
        <Link href="/venues">Find a venue</Link>
        <Link href={`/venues/${venue.tenant.slug}`}>{venue.tenant.name}</Link>
        <Link href={path}>Location</Link>
        <Link href={`${path}/menu`}>{venue.menu?.schemaVersion===2?'Food & drinks menu':'Beverage menu'}</Link>
      </nav>
      <header className="space-y-4 rounded-2xl bg-stone-950 p-6 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">{venue.types.join(' · ')}</p>
        <h1 className="font-[var(--font-kavoon)] text-3xl font-normal sm:text-4xl">
          {venue.name}
          {menuOnly ? venue.menu?.schemaVersion===2?' · Food & drinks menu':' · Beverage menu' : ''}
        </h1>
        <p className="max-w-2xl leading-7 text-stone-300">{venue.description}</p>
        <p className="flex gap-2 font-medium">
          <PiMapPin size={18} className="mt-1 shrink-0 text-amber-200" aria-hidden="true" />
          {venue.address}
        </p>
        <p className="text-sm text-stone-300">Venue time: {venue.timezone}</p>
      </header>
      {!!venue.photos?.length && (
        <div className="grid gap-4 sm:grid-cols-2">
          {venue.photos.map((photo) => (
            <Image
              key={photo.url}
              src={photo.url}
              alt={photo.alt}
              width={960}
              height={640}
              sizes="(max-width: 639px) 100vw, 50vw"
              className="aspect-[3/2] w-full rounded-xl object-cover"
            />
          ))}
        </div>
      )}
      {venue.publicPhone && (
        <p className="flex flex-wrap items-center gap-x-2 text-stone-700">
          Contact the venue:{' '}
          <a
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg font-semibold text-red-800 underline underline-offset-4 hover:text-red-900 ${focus}`}
            href={`tel:${venue.publicPhone.replace(/[^+0-9]/g, '')}`}
          >
            <PiPhone size={18} aria-hidden="true" />
            {venue.publicPhone}
          </a>
        </p>
      )}
      {!menuOnly && (
        <>
          <section className="space-y-3 rounded-2xl border border-stone-200 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Opening hours</h2>
            {!venue.hours.length ? (
              <p>Contact the venue to check its opening hours.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-stone-700 [&_li]:py-2">
                {venue.hours.map((h, i) => (
                  <li key={i}>
                    {
                      [
                        'Sunday',
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                      ][h.day]
                    }{' '}
                    · {h.opens}–{h.closes}
                    {h.overnight ? ' next day' : ''}
                  </li>
                ))}
              </ul>
            )}
            {!!venue.exceptions.length && (
              <>
                <h3 className="mt-3 font-semibold">Opening exceptions</h3>
                <ul>
                  {venue.exceptions.map((e, i) => (
                    <li key={i}>
                      {e.date}:{' '}
                      {e.closed
                        ? 'Closed'
                        : `${e.opens}–${e.closes}${e.overnight ? ' next day' : ''}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="space-y-3 rounded-2xl border border-stone-200 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Visit policies</h2>
            <p className="whitespace-pre-wrap leading-7 text-stone-600">{venue.policies}</p>
          </section>
        </>
      )}
      <VenueMenu venue={venue} />
      <EventOccurrences venue={venue} />
      <div className="flex flex-wrap gap-4">
        {venue.bookingMode === 'request' && (
          <Link
            className={`inline-flex min-h-12 items-center rounded-xl bg-red-800 px-5 py-3 font-semibold text-white transition hover:bg-red-900 ${focus}`}
            href={`${path}/reserve`}
          >
            Request a table
          </Link>
        )}
        {venue.retailAvailable && (
          <Link
            className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 font-semibold text-stone-900 transition hover:border-red-800 hover:text-red-800 ${focus}`}
            href={`/vendors/${encodeURIComponent(venue.tenant.slug)}`}
          >
            <PiBasketBold size={18} aria-hidden="true" />
            Shop delivery and pickup drinks
          </Link>
        )}
        <Link
          href="/contact"
          className={`inline-flex min-h-11 items-center rounded-lg px-3 py-3 underline underline-offset-4 hover:text-red-800 ${focus}`}
        >
          Contact platform support
        </Link>
      </div>
    </main>
  );
}
