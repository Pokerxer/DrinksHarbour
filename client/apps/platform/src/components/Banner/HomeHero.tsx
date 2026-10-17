import HeroBanner from './HeroBanner';
import type { BannerData } from './hero-banner-types';
import { API_URL } from '@/lib/api';

/** Deliver the LCP image in HTML instead of waiting for hydration + fetch. */
export default async function HomeHero() {
  try {
    const response = await fetch(`${API_URL}/api/banners/placement/home_hero?limit=5`, {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Banner request failed');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error('Invalid banner response');
    const banners: BannerData[] = data.data;
    return <HeroBanner initialBanners={banners} initialBannersComplete />;
  } catch {
    // A temporary server failure can still recover through the client request.
    return <HeroBanner />;
  }
}
