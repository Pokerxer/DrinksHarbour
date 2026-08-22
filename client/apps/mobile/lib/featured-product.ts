import type { RawProduct } from './catalog-api.ts';
import type { AvailableAt, ProductSize } from './flash-sale.ts';

/**
 * Featured-products mapping — a port of
 * apps/platform/src/components/Home1/FeaturedProducts/mapApiProduct.ts.
 *
 * Trusts the server's own sale signals (`search.service.js` already computes
 * `sale` and `originPrice`) and only re-derives when they are missing.
 */

export interface FeaturedProductView {
  _id: string;
  slug: string;
  name: string;
  price: number;
  originPrice: number;
  sale: boolean;
  discount: number;
  imageUrl: string | null;
  averageRating: number;
  reviewCount: number;
  isNew: boolean;
  totalSold: number;
  totalStock: number;
  availableStock: number;
  sizes?: ProductSize[];
  defaultSize?: string;
  tenantCount: number;
  tenantKeys: string[];
}

const NEW_PRODUCT_WINDOW_DAYS = 30;

const toBoolean = (value: unknown): boolean => value === true || value === 'true';

const firstImageUrl = (api: RawProduct): string | null => {
  const primary = api.primaryImage?.url;
  if (typeof primary === 'string' && primary) return primary;
  for (const img of api.images ?? []) {
    if (typeof img?.url === 'string' && img.url) return img.url;
  }
  return null;
};

const offersOf = (api: RawProduct): AvailableAt[] =>
  Array.isArray(api?.availableAt) ? (api.availableAt as AvailableAt[]) : [];

const computeStock = (api: RawProduct) => {
  const entries = offersOf(api);
  const totalStock = entries.reduce((sum, e) => sum + (e.totalStock ?? 0), 0);
  const availableStock = entries.reduce((sum, e) => sum + (e.availableStock ?? 0), 0);
  // A product with offers but no per-offer counters is assumed stocked, exactly
  // as the web does — otherwise every card would read "Out of Stock".
  const fallbackStock = entries.length > 0 ? 100 : 0;
  return {
    totalStock: totalStock > 0 ? totalStock : fallbackStock,
    availableStock,
    totalSold: (api.totalSold as number | undefined) ?? 0,
  };
};

const computeIsNew = (api: RawProduct, nowMs: number): boolean => {
  const createdAt = api.createdAt;
  if (typeof createdAt !== 'string') return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return nowMs - created <= NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

export function mapFeaturedProduct(api: RawProduct, nowMs: number): FeaturedProductView | null {
  // Without a slug the card has nowhere to navigate.
  if (!api?._id || typeof api.slug !== 'string' || !api.slug) return null;

  const offers = offersOf(api);
  const availableAt = offers[0];
  const sizes = availableAt?.sizes;
  const firstSize = sizes?.[0];
  const sizePricing = firstSize?.pricing;
  const entryPricing = availableAt?.pricing;
  const volumeMl = api.volumeMl as number | undefined;
  const priceRange = api.priceRange as { min?: number; max?: number } | null | undefined;

  const defaultSize = firstSize?.size || (volumeMl ? `${volumeMl}ml` : undefined);

  const websitePrice =
    sizePricing?.websitePrice || entryPricing?.websitePrice || priceRange?.min || 0;
  const compareAtPrice =
    sizePricing?.originalWebsitePrice ||
    entryPricing?.compareAtPrice ||
    entryPricing?.originalWebsitePrice ||
    (api.originPrice as number | undefined) ||
    priceRange?.max ||
    websitePrice;

  const serverSale =
    toBoolean(api.sale) || toBoolean(api.isOnSale) || toBoolean(availableAt?.isOnSale);
  const saleDiscountValue =
    availableAt?.saleDiscountValue || (api.discount as { value?: number } | undefined)?.value || 0;
  const derivedDiscount =
    compareAtPrice > websitePrice && websitePrice > 0
      ? Math.round((1 - websitePrice / compareAtPrice) * 100)
      : 0;
  const sale = serverSale || derivedDiscount > 0;
  const discount = sale ? Math.max(saleDiscountValue, derivedDiscount) : 0;
  const price =
    sale && discount > 0
      ? Math.round(websitePrice * (1 - Math.min(discount, 100) / 100))
      : websitePrice;

  const { totalStock, availableStock, totalSold } = computeStock(api);

  const tenantKeys = offers
    .map((e) => e?.tenant?._id || e?.tenant?.name)
    .filter((key): key is string => typeof key === 'string' && key.length > 0);

  return {
    _id: String(api._id),
    slug: api.slug,
    name: typeof api.name === 'string' ? api.name : '',
    price,
    originPrice: compareAtPrice,
    sale,
    discount,
    imageUrl: firstImageUrl(api),
    averageRating: (api.averageRating as number | undefined) || 0,
    reviewCount: (api.reviewCount as number | undefined) || 0,
    isNew: computeIsNew(api, nowMs),
    totalSold,
    totalStock,
    availableStock,
    sizes,
    defaultSize,
    tenantCount: offers.length,
    tenantKeys,
  };
}

/** Defense-in-depth: keep only products the API explicitly flagged as featured. */
export function filterFeatured(products: RawProduct[] | null | undefined): RawProduct[] {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => toBoolean(p.isFeatured));
}

export function mapFeaturedProducts(
  products: RawProduct[] | null | undefined,
  nowMs: number
): FeaturedProductView[] {
  return filterFeatured(products)
    .map((p) => mapFeaturedProduct(p, nowMs))
    .filter((v): v is FeaturedProductView => v !== null);
}

/** The three numbers in the section header: count, mean rating, distinct tenants. */
export function featuredStats(views: FeaturedProductView[]): {
  count: number;
  avgRating: number;
  tenantsCount: number;
} {
  if (!views.length) return { count: 0, avgRating: 0, tenantsCount: 0 };

  const tenants = new Set<string>();
  for (const view of views) for (const key of view.tenantKeys) tenants.add(key);

  return {
    count: views.length,
    avgRating: views.reduce((sum, v) => sum + v.averageRating, 0) / views.length,
    tenantsCount: tenants.size,
  };
}

/** A size is sold out when it says so, or when it reports a non-positive stock. */
export function isSizeOutOfStock(size: ProductSize | null | undefined): boolean {
  if (!size) return false;
  return size.inStock === false || (typeof size.stock === 'number' && size.stock <= 0);
}

/** Live price for the first size, falling back to the product's mapped price. */
export function priceForSize(
  size: ProductSize | null | undefined,
  fallback: number
): { price: number; originPrice: number } {
  const website = size?.pricing?.websitePrice;
  const original = size?.pricing?.originalWebsitePrice;
  return {
    price: website && website > 0 ? website : fallback,
    originPrice: original && original > 0 ? original : website ?? fallback,
  };
}
