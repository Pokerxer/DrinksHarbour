import type { BannerData as Announcement } from './AnnouncementBanner';
import type { BannerData as Promotion } from './PlacementBanner';

export interface ProductBannerSeed { header: Announcement[]; product: Promotion[] }

/** Optional ads must settle before the product renders, never push it down later. */
export async function fetchProductBannerSeed(apiUrl: string): Promise<ProductBannerSeed> {
  async function placement<T>(name: string, limit: number): Promise<T[]> {
    try {
      const response = await fetch(`${apiUrl}/api/banners/placement/${name}?limit=${limit}`, {
        cache: 'no-store', signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    } catch { return []; }
  }
  const [header, product] = await Promise.all([
    placement<Announcement>('header', 5), placement<Promotion>('product_page', 1),
  ]);
  return { header, product };
}
