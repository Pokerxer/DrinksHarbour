import type { RawProduct } from './catalog-api.ts';
import type { AvailableAt, SizeDiscount } from './flash-sale.ts';

/**
 * "Recommended For You" — a port of apps/platform/src/components/Shop/
 * recommendations.ts (`normalizeProducts`, `isPublishedProduct`,
 * `normalizeProduct`) plus the sale/price derivation the web's
 * `Product/Card` grid type applies on top of it.
 *
 * The two are combined here because the mobile card is one component; on the
 * web they are split only because `normalizeProduct` is also used server-side.
 */

// ─── Publication gate ────────────────────────────────────────────────────────

const UNPUBLISHED_STATUSES = new Set([
  'draft',
  'pending',
  'rejected',
  'archived',
  'discontinued',
]);

/**
 * Absent flags are treated as published, so a leaner API payload does not hide
 * legitimate products.
 */
export function isPublishedProduct(p: RawProduct | null | undefined): boolean {
  if (!p) return false;
  if (p.isPublished === false) return false;
  if (typeof p.status === 'string' && UNPUBLISHED_STATUSES.has(p.status)) return false;
  return true;
}

export function isProductNew(createdAt: unknown, nowMs: number): boolean {
  if (typeof createdAt !== 'string') return false;
  const parsed = Date.parse(createdAt);
  if (!Number.isFinite(parsed)) return false;
  return parsed > nowMs - 7 * 24 * 60 * 60 * 1000;
}

/**
 * `normalizeProduct`'s stock coalesce, in its own order (recommendations.ts:78).
 *
 * This is load-bearing, not cosmetic: the section filters on
 * `stockInfo.totalStock > 0`, and the trending/bestsellers endpoints publish the
 * count as a FLAT `totalStock`. Reading only `stockInfo` would filter every
 * product out and render "Nothing here yet" over a healthy payload.
 */
export function totalStockOf(p: RawProduct | null | undefined): number {
  if (!p) return 0;
  const flat = p.totalStock;
  if (typeof flat === 'number') return flat;

  const availability = p.availability as { totalStock?: number } | undefined;
  if (typeof availability?.totalStock === 'number') return availability.totalStock;

  const stockInfo = p.stockInfo as { totalStock?: number } | undefined;
  return typeof stockInfo?.totalStock === 'number' ? stockInfo.totalStock : 0;
}

// ─── Card view ───────────────────────────────────────────────────────────────

export type SaleBadgeKind = 'flash_sale' | 'fixed' | 'percentage' | 'product_badge' | null;

export interface RecommendedCardView {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** What the shopper pays. */
  price: number;
  /** Only set when the strike-through should show. */
  originalPrice: number | null;
  showStrikethrough: boolean;
  /** Ranked badge: flash > fixed > percentage > product badge (web ordering). */
  badge: SaleBadgeKind;
  /** `-25%`, `-₦3,000`, or the product badge's own name. */
  badgeLabel: string | null;
  badgeColor: string | null;
  isOutOfStock: boolean;
  isNew: boolean;
  abv: number | null;
  origin: string | null;
}

const offersOf = (p: RawProduct): AvailableAt[] =>
  Array.isArray(p?.availableAt) ? (p.availableAt as AvailableAt[]) : [];

const imageUrlOf = (p: RawProduct): string | null => {
  const primary = p.primaryImage?.url;
  if (typeof primary === 'string' && primary) return primary;
  for (const img of p.images ?? []) {
    if (typeof img?.url === 'string' && img.url) return img.url;
  }
  return null;
};

const naira = (value: number) => `₦${Math.round(value).toLocaleString('en-NG')}`;

/**
 * Mirrors `Product/Card`'s sale resolution (index.tsx:583-706): server-computed
 * `originalWebsitePrice > websitePrice` wins; only when the server did not
 * compute it does the card apply the raw sale value itself, and only inside the
 * sale's own date window.
 */
export function toRecommendedCardView(
  product: RawProduct | null | undefined,
  nowMs: number
): RecommendedCardView | null {
  if (!product?._id || typeof product.slug !== 'string' || !product.slug) return null;

  const vendors = offersOf(product);
  const firstSaleVendor = vendors.find((v) => v.isOnSale === true);
  const vendorWithSale = vendors.find((v) => v.isOnSale === true || (v.saleDiscountValue ?? 0) > 0);
  const firstVendor = vendors[0];

  // The server puts the discount on the SIZE, not the vendor.
  const vendorDiscount: SizeDiscount | null | undefined =
    firstSaleVendor?.sizes?.[0]?.discount ?? firstSaleVendor?.discount;
  const productLevelDiscount = product.discount as SizeDiscount | undefined;
  const productLevelIsOnSale = product.isOnSale === true;
  const productLevelSaleType = (product.saleType as string | undefined) ?? null;

  const sizeForCalc = (vendorWithSale ?? firstVendor)?.sizes?.[0];
  const priceFromCalc = sizeForCalc?.pricing?.websitePrice ?? 0;
  const origFromCalc = sizeForCalc?.pricing?.originalWebsitePrice ?? priceFromCalc;
  const calculatedSavings = origFromCalc > priceFromCalc ? Math.round(origFromCalc - priceFromCalc) : 0;
  const calculatedPercent =
    origFromCalc > priceFromCalc && origFromCalc > 0
      ? Math.round((1 - priceFromCalc / origFromCalc) * 100)
      : 0;

  const hasActiveSale =
    firstSaleVendor?.isOnSale === true ||
    productLevelIsOnSale ||
    vendorDiscount?.hasDiscount === true ||
    (firstSaleVendor?.saleDiscountValue ?? 0) > 0 ||
    productLevelDiscount?.hasDiscount === true ||
    calculatedSavings > 0;

  const discount = vendorDiscount || productLevelDiscount;
  const saleInfo =
    discount || firstSaleVendor?.isOnSale || productLevelIsOnSale || calculatedSavings
      ? {
          type: firstSaleVendor?.saleType || productLevelSaleType || discount?.type || 'percentage',
          value:
            firstSaleVendor?.saleDiscountValue ||
            discount?.value ||
            discount?.savings ||
            calculatedSavings,
          percentage: discount?.percentage || calculatedPercent,
          saleStartDate: firstSaleVendor?.saleStartDate ?? null,
          saleEndDate: firstSaleVendor?.saleEndDate ?? null,
        }
      : null;

  const priceRange = product.priceRange as { min?: number; max?: number } | null | undefined;
  const firstSizePricing = (vendorWithSale ?? firstVendor)?.sizes?.[0]?.pricing ?? {};
  const currentPrice =
    firstSizePricing.websitePrice || (product.price as number | undefined) || priceRange?.min || 0;
  const origPrice =
    firstSizePricing.originalWebsitePrice ||
    (product.originPrice as number | undefined) ||
    priceRange?.max ||
    currentPrice;

  let displayPrice = currentPrice;
  let displayOriginalPrice = 0;
  let showStrikethrough = false;

  if (origPrice > currentPrice && currentPrice > 0) {
    displayOriginalPrice = origPrice;
    showStrikethrough = true;
  } else if (hasActiveSale && saleInfo && saleInfo.value > 0 && currentPrice > 0) {
    const start = saleInfo.saleStartDate ? Date.parse(saleInfo.saleStartDate) : null;
    const end = saleInfo.saleEndDate ? Date.parse(saleInfo.saleEndDate) : null;
    const active =
      (start === null || !Number.isFinite(start) || nowMs >= start) &&
      (end === null || !Number.isFinite(end) || nowMs <= end);

    if (active) {
      const computed =
        saleInfo.type === 'fixed'
          ? Math.max(0, currentPrice - saleInfo.value)
          : Number((currentPrice * (1 - saleInfo.value / 100)).toFixed(2));
      if (computed < currentPrice) {
        displayPrice = computed;
        displayOriginalPrice = currentPrice;
        showStrikethrough = true;
      }
    }
  }

  const productBadge = product.badge as { name?: string; color?: string; type?: string } | undefined;

  let badge: SaleBadgeKind = null;
  let badgeLabel: string | null = null;
  let badgeColor: string | null = null;

  if (saleInfo && hasActiveSale) {
    if (saleInfo.type === 'flash_sale') {
      badge = 'flash_sale';
      badgeLabel = `-${saleInfo.percentage || saleInfo.value}%`;
    } else if (saleInfo.type === 'fixed') {
      badge = 'fixed';
      badgeLabel = `-${naira(saleInfo.value)}`;
    } else {
      badge = 'percentage';
      badgeLabel = `-${saleInfo.percentage || saleInfo.value}%`;
    }
  } else if (productBadge?.name) {
    badge = 'product_badge';
    badgeLabel = productBadge.name.toUpperCase();
    badgeColor = productBadge.color || '#10B981';
  }

  const totalStock = totalStockOf(product);

  const abv = product.abv;
  const region = product.region ?? product.originCountry;

  return {
    id: String(product._id),
    slug: product.slug,
    name: typeof product.name === 'string' ? product.name : '',
    imageUrl: imageUrlOf(product),
    price: displayPrice,
    originalPrice: showStrikethrough ? displayOriginalPrice : null,
    showStrikethrough,
    badge,
    badgeLabel,
    badgeColor,
    isOutOfStock: totalStock <= 0,
    isNew: productBadge?.type === 'new-arrival' || isProductNew(product.createdAt, nowMs),
    abv: typeof abv === 'number' && abv > 0 ? abv : null,
    origin: typeof region === 'string' && region ? region : null,
  };
}

/**
 * The section's own filter chain (RecommendedForYou.tsx:163-170): published,
 * in stock, then capped at `maxItems`.
 */
export function toRecommendedCardViews(
  products: RawProduct[] | null | undefined,
  nowMs: number,
  maxItems: number
): RecommendedCardView[] {
  if (!Array.isArray(products)) return [];
  return products
    .filter(isPublishedProduct)
    .filter((p) => totalStockOf(p) > 0)
    .slice(0, maxItems)
    .map((p) => toRecommendedCardView(p, nowMs))
    .filter((v): v is RecommendedCardView => v !== null);
}
