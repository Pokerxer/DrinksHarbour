import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import RequestForm from '@/components/Venues/request-form';
import { assertVenueHost, publicVenueGet } from '@/lib/venue/server';
import type { VenueLocation } from '@/lib/venue/types';
export const metadata = {
  title: 'Request a table',
  robots: { index: false, follow: false },
};
export default async function ReservePage({
  params,
}: {
  params: Promise<{ slug: string; locationSlug: string }>;
}) {
  const { slug, locationSlug } = await params;
  await assertVenueHost(slug);
  const venue = await publicVenueGet<VenueLocation>(
    `/${encodeURIComponent(slug)}/${encodeURIComponent(locationSlug)}`,
  );
  if (venue.bookingMode !== 'request') notFound();
  // The skeleton mirrors RequestForm's labelled blocks so the loaded form
  // lands in the reserved space without content jumping (CLS-safe).
  const skeleton = (
    <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-6">
      <span className="sr-only">Loading request form…</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <span className="block h-3 w-32 rounded-full bg-stone-200" />
        <span className="block h-10 max-w-xl rounded-xl bg-stone-200" />
        <span className="block h-5 w-3/4 rounded-xl bg-stone-200" />
        <span className="block h-5 w-2/3 rounded-xl bg-stone-200" />
        <span className="block h-9 w-72 rounded-full bg-amber-100" />
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <span className="block h-4 w-44 rounded bg-stone-200" />
          <span className="mt-1 block h-12 w-full rounded-xl bg-stone-100" />
          <span className="mt-6 block h-4 w-24 rounded bg-stone-200" />
          <span className="mt-1 block h-12 w-full rounded-xl bg-stone-100" />
          <span className="mt-6 block h-16 w-full rounded-xl border border-stone-100 bg-stone-50" />
          <span className="mt-6 block h-6 w-64 rounded bg-stone-200" />
          <span className="mt-6 block h-12 w-full max-w-xs rounded-xl bg-stone-200" />
        </section>
        <span className="block h-5 w-48 rounded bg-stone-200" />
      </div>
    </div>
  );
  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={skeleton}>
        <RequestForm venue={venue} />
      </Suspense>
    </main>
  );
}
