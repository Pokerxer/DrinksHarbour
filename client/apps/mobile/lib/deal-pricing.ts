import type { RawProduct } from './catalog-api.ts';
import type { AvailableAt, ProductSize, SizeDiscount } from './flash-sale.ts';

/**
 * "Hot Deals" pricing — a port of `resolveBestOffer` / `calcPricing` /
 * `promotedFirst` from apps/platform/src/components/Home1/FeaturedDeals.tsx.
 *
 * Kept separate from flash-sale.ts even though the two overlap: the web has two
 * independent implementations that disagree in one place (this one falls back to
 * `originalPrice > currentPrice` when `hasDiscount` is absent, the flash-sale one
 * does not), and collapsing them here would silently change what the cards show.
 */

export interface DealPricing {
  currentPrice: number;
  originalPrice: number;
  hasDiscount: boolean;
  isFlashSale: boolean;
  isFixed: boolean;
  fixedAmountOff: number;
  discountPercent: number;
}

const offersOf = (product: RawProduct): AvailableAt[] =>
  Array.isArray(product?.availableAt) ? (product.availableAt as AvailableAt[]) : [];

export function resolveBestOffer(product: RawProduct): {
  offer: AvailableAt | undefined;
  size: ProductSize | undefined;
} {
  const offers = offersOf(product);
  let bestSize: ProductSize | undefined;
  let bestOffer: AvailableAt | undefined;
  let bestSavings = -1;

  for (const offer of offers) {
    for (const size of offer.sizes ?? []) {
      const savings = size.discount?.hasDiscount ? size.discount?.savings ?? 0 : 0;
      if (savings > bestSavings) {
        bestSavings = savings;
        bestSize = size;
        bestOffer = offer;
      }
    }
  }

  // No discounted size found — default to the first available size for pricing.
  if (!bestSize) {
    bestOffer = offers[0];
    bestSize = bestOffer?.sizes?.[0];
  }

  return { offer: bestOffer, size: bestSize };
}

export function calcPricing(product: RawProduct): DealPricing {
  const { offer, size } = resolveBestOffer(product);
  const sizeDiscount: SizeDiscount = size?.discount || offer?.discount || {};
  const sizePricing = size?.pricing ?? {};
  const priceRange = product?.priceRange as { min?: number } | null | undefined;

  const currentPrice = sizePricing.websitePrice || priceRange?.min || 0;
  const originalPrice = sizePricing.originalWebsitePrice || currentPrice;
  const hasDiscount =
    !!sizeDiscount.hasDiscount || (originalPrice > currentPrice && currentPrice > 0);
  const saleType = offer?.saleType || sizeDiscount.type || 'percentage';
  const isFlashSale = saleType === 'flash_sale';
  const isFixed = saleType === 'fixed';
  const fixedAmountOff =
    sizeDiscount.savings || (hasDiscount ? Math.round(originalPrice - currentPrice) : 0);
  const discountPercent =
    sizeDiscount.percentage ||
    (hasDiscount && originalPrice > 0
      ? Math.round((1 - currentPrice / originalPrice) * 100)
      : 0);

  return {
    currentPrice,
    originalPrice,
    hasDiscount,
    isFlashSale,
    isFixed,
    fixedAmountOff,
    discountPercent,
  };
}

export function hasActivePromo(product: RawProduct): boolean {
  return calcPricing(product).hasDiscount;
}

/**
 * Promoted products lead the grid regardless of the order the API returns them,
 * so "Hot Deals" always shows its real deals first. The index tiebreak keeps the
 * sort stable — within a group the API's order survives.
 */
export function promotedFirst(products: RawProduct[] | null | undefined): RawProduct[] {
  if (!Array.isArray(products)) return [];
  return products
    .map((product, index) => ({ product, index, promo: hasActivePromo(product) }))
    .sort((a, b) => (a.promo === b.promo ? a.index - b.index : a.promo ? -1 : 1))
    .map((entry) => entry.product);
}

/** The stock the deal card's status row reads (FeaturedDeals.tsx:235). */
export function dealStock(product: RawProduct): number | undefined {
  const { size } = resolveBestOffer(product);
  return size?.stock ?? offersOf(product)[0]?.sizes?.[0]?.stock;
}
