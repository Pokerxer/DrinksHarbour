import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export async function assertVenueHost(slug?: string) {
  if (process.env.VENUE_EXPERIENCE_ENABLED !== 'true') notFound();
  const hostTenant = (await headers()).get('x-tenant-slug');
  if (slug && hostTenant && hostTenant !== slug) notFound();
  return hostTenant;
}
export async function publicVenueGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/api/venue-experience/public${path}`, {
    cache: 'no-store',
  });
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error('Venue details are temporarily unavailable. Please retry.');
  const result = (await response.json()) as { data: T };
  return result.data;
}
