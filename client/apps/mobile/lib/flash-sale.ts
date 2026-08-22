import type { RawProduct } from './catalog-api.ts';

/**
 * Flash-sale card derivation — a port of `getBestSale` from
 * apps/platform/src/components/Home1/FlashSale.tsx.
 *
 * The backend attaches the discount object to the specific SIZE on sale, which
 * is not necessarily `availableAt[0].sizes[0]`. Scanning for the largest
 * `savings` is what makes the badge agree with the price beneath it.
 */

export interface SizeDiscount {
  hasDiscount?: boolean;
  type?: string;
  value?: number;
  percentage?: number;
  savings?: number;
  originalPrice?: number;
  source?: string;
  label?: string;
}

export interface ProductSize {
  _id?: string;
  size?: string;
  volumeMl?: number;
  stock?: number;
  inStock?: boolean;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
    currency?: string;
    formattedPrice?: string;
  };
  discount?: SizeDiscount | null;
}

export interface AvailableAt {
  _id?: string;
  tenant?: { _id?: string; name?: string; slug?: string };
  sizes?: ProductSize[];
  isOnSale?: boolean;
  saleType?: string;
  saleDiscountValue?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  totalStock?: number;
  availableStock?: number;
  discount?: SizeDiscount | null;
  pricing?: { websitePrice?: number; originalWebsitePrice?: number; compareAtPrice?: number };
}

export interface BestSale {
  currentPrice: number;
  originalPrice: number;
  hasDiscount: boolean;
  discountPct: number;
  saleType: string | null;
  saleEndDate: string | null;
  stock: number | undefined;
  discountLabel: string | null;
}

const offersOf = (product: RawProduct): AvailableAt[] =>
  Array.isArray(product?.availableAt) ? (product.availableAt as AvailableAt[]) : [];

export function getBestSale(product: RawProduct): BestSale {
  const allAt = offersOf(product);

  let bestDiscount: SizeDiscount | null = null;
  let bestSize: ProductSize | null = null;
  let bestAt: AvailableAt | null = null;

  for (const at of allAt) {
    for (const size of at.sizes ?? []) {
      const d = size.discount;
      if (!d?.hasDiscount) continue;
      if (!bestDiscount || (d.savings ?? 0) > (bestDiscount.savings ?? 0)) {
        bestDiscount = d;
        bestSize = size;
        bestAt = at;
      }
    }
  }

  if (!bestDiscount || !bestSize || !bestAt) {
    const firstAt = allAt[0];
    const firstSize = firstAt?.sizes?.[0];
    const pricing = firstSize?.pricing ?? {};
    const priceRange = product?.priceRange as { min?: number } | null | undefined;
    const current = pricing.websitePrice || priceRange?.min || 0;
    const original = pricing.originalWebsitePrice || current;
    const savings = original - current;

    return {
      currentPrice: current,
      originalPrice: original,
      hasDiscount: savings > 0 && current > 0,
      discountPct: savings > 0 ? Math.round((savings / original) * 100) : 0,
      saleType: firstAt?.saleType ?? null,
      saleEndDate: firstAt?.saleEndDate ?? null,
      stock: firstSize?.stock,
      discountLabel: null,
    };
  }

  return {
    currentPrice: bestSize.pricing?.websitePrice ?? 0,
    originalPrice: bestDiscount.originalPrice ?? bestSize.pricing?.websitePrice ?? 0,
    hasDiscount: true,
    discountPct: bestDiscount.percentage ?? 0,
    saleType: bestAt.saleType ?? null,
    saleEndDate: bestAt.saleEndDate ?? null,
    stock: bestSize.stock,
    discountLabel: bestDiscount.label ?? null,
  };
}

/**
 * The web section titles itself "Flash Sale" only when at least one offer in the
 * payload is literally a `flash_sale`; otherwise "On Sale Now".
 */
export function isFlashSaleSection(products: RawProduct[] | null | undefined): boolean {
  if (!Array.isArray(products)) return false;
  return products.some((p) => offersOf(p).some((at) => at.saleType === 'flash_sale'));
}

/**
 * Prefer products whose sizes carry a real discount; fall back to the whole
 * payload when none do, so the rail is never empty for a formatting reason
 * (FlashSale.tsx:441-446).
 */
export function withDiscountFirst(products: RawProduct[] | null | undefined): RawProduct[] {
  if (!Array.isArray(products)) return [];
  const withDiscount = products.filter((p) =>
    offersOf(p).some((at) => (at.sizes ?? []).some((s) => s.discount?.hasDiscount))
  );
  return withDiscount.length > 0 ? withDiscount : products;
}

/** `stockInfo` is the flat shape the list endpoints publish; both fields optional. */
export function stockInfoOf(product: RawProduct): { totalStock?: number; availableStock?: number } {
  const info = product?.stockInfo as { totalStock?: number; availableStock?: number } | undefined;
  return info ?? {};
}

/** "1.2k sold" / "840 sold" — the web's own abbreviation rule. */
export function formatSoldCount(totalSold: number): string {
  return totalSold >= 1000 ? `${(totalSold / 1000).toFixed(1)}k` : String(totalSold);
}
