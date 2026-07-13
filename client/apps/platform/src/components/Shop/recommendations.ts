// Shared normalisation + server fetch for the "Recommended For You" section.
//
// Used by BOTH RecommendedForYou.tsx (client, for tab switching / auth
// personalization / refresh) and the shop server component (to SSR the initial
// section so its product cards + /product links are in the raw HTML for
// crawlers). Keeping the shaping logic here means the server-seeded products and
// the client's own fetches produce identical objects, so hydration matches.

export const REC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export function normalizeProducts(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.products && Array.isArray(data.products)) return data.products;
  if (data?.data?.products && Array.isArray(data.data.products)) return data.data.products;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

// A product is shown in storefront sections only when it is live to shoppers.
// Guards against approved-but-unpublished (or draft/archived) items that a
// non-strict endpoint might return. Absent flags are treated as published so a
// leaner API payload doesn't hide legitimate products.
const UNPUBLISHED_STATUSES = new Set(['draft', 'pending', 'rejected', 'archived', 'discontinued']);

export function isPublishedProduct(p: any): boolean {
  if (!p) return false;
  if (p.isPublished === false) return false;
  if (typeof p.status === 'string' && UNPUBLISHED_STATUSES.has(p.status)) return false;
  return true;
}

export function isProductNew(createdAt: string): boolean {
  try {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(createdAt).getTime() > weekAgo;
  } catch {
    return false;
  }
}

export function normalizeProduct(p: any): any {
  const id = p._id ?? p.id;
  const primaryImage =
    p.primaryImage ??
    p.images?.find((i: any) => i.isPrimary) ??
    p.images?.[0] ??
    null;

  const allPrices = (p.availableAt || []).flatMap((store: any) =>
    (store.sizes || []).map((size: any) => size.pricing?.websitePrice).filter(Boolean)
  );
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : (p.priceRange?.min ?? 0);
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : (p.priceRange?.max ?? minPrice);
  const currency = p.priceRange?.currency ?? 'NGN';

  const disc = p.discount;
  const hasRealDiscount = disc?.savings > 0;
  const originPrice = hasRealDiscount ? (disc.originalPrice ?? minPrice) : minPrice;
  const discountPct = hasRealDiscount
    ? (disc.type === 'percentage'
        ? disc.value
        : disc.originalPrice > 0
          ? Math.round((disc.savings / disc.originalPrice) * 100)
          : 0)
    : undefined;

  const vendorOnSale = (p.availableAt || []).some((v: any) => v.isOnSale === true);
  const isOnSale = vendorOnSale || hasRealDiscount;

  const rating = p.averageRating ?? p.rating ?? p.stats?.averageRating ?? 0;
  const reviewCount = p.reviewCount ?? p.stats?.reviewCount ?? 0;
  const totalSold = p.totalSold ?? p.stats?.totalSold ?? p.trending?.quantitySold ?? 0;
  const totalStock =
    p.totalStock ?? p.availability?.totalStock ?? p.stockInfo?.totalStock ?? p.stats?.totalStock ?? 0;
  const tenantCount = p.availability?.tenantCount ?? p.tenantCount ?? p.tenants?.length ?? 0;

  return {
    ...p,
    _id: id,
    flavors: p.flavors ?? [],
    images: p.images ?? [],
    primaryImage,
    priceRange: {
      min: minPrice,
      max: maxPrice,
      currency,
      formatted: p.priceRange?.formatted,
      display: p.priceRange?.display ?? `₦${minPrice.toLocaleString()}`,
    },
    price: minPrice,
    originPrice,
    discount: discountPct,
    sale: isOnSale,
    new: p.badge?.type === 'new-arrival' || isProductNew(p.createdAt),
    averageRating: rating,
    reviewCount,
    totalSold,
    originCountry: p.originCountry ?? p.country ?? '',
    stockInfo: {
      totalStock,
      availableStock: totalStock,
      tenants: tenantCount,
      totalSizes: p.sizeCount ?? p.sizes?.length ?? 0,
    },
    availability: {
      status:
        p.availability?.status ??
        (p.isInStock !== false && totalStock > 0 ? 'in_stock' : 'out_of_stock'),
      stockLevel:
        p.availability?.stockLevel ?? p.stockLevel ?? (totalStock > 0 ? 'medium' : 'out'),
      availableFrom: tenantCount,
      message: p.availability?.message ?? p.availability?.availabilitySummary ?? '',
    },
  };
}

// Server-side fetch for the initial (anonymous) section — this is the `trending`
// endpoint, matching what RecommendedForYou loads first for a logged-out user.
export async function fetchInitialRecommendations(maxItems = 12): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/products/trending?limit=${maxItems}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.success === false) return [];
    return normalizeProducts(data).map(normalizeProduct);
  } catch {
    return [];
  }
}
