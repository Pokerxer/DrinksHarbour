import LocationView from '@/components/Venues/location-view';
import { assertVenueHost, publicVenueGet } from '@/lib/venue/server';
import type { VenueLocation } from '@/lib/venue/types';
export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string; locationSlug: string }>;
}) {
  const { slug, locationSlug } = await params;
  await assertVenueHost(slug);
  const venue = await publicVenueGet<VenueLocation>(
    `/${encodeURIComponent(slug)}/${encodeURIComponent(locationSlug)}`,
  );
  return <LocationView venue={venue} menuOnly />;
}
