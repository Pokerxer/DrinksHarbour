/**
 * The variant a product page shows before the shopper picks one.
 *
 * The server (JSON-LD Offer, og:product meta) and the client (Product Detail
 * component) MUST agree on this. When they disagreed, the server rendered
 * `priceRange.min` — the cheapest variant, frequently out of stock — while the
 * browser showed the first in-stock variant, so Google and Merchant Center read
 * a price and availability no real visitor ever saw. This module is the single
 * definition of "the default variant"; both sides import it.
 */

/** First in-stock entry, falling back to the first entry when all are sold out. */
export function pickDefaultSizeFrom<T extends { stock?: number }>(
  sizes: T[] | undefined | null,
): T | null {
  if (!sizes?.length) return null;
  return sizes.find((s) => (s?.stock ?? 0) > 0) ?? sizes[0];
}

export interface DefaultVariant {
  size?: string;
  stock: number;
  price?: number;
  originalPrice?: number;
  currencySymbol?: string;
}

/**
 * Resolve the default variant off a raw product document, mirroring the Detail
 * component: the first vendor in `availableAt`, then `pickDefaultSizeFrom`.
 * Returns null for products with no vendor sizes (callers then fall back to
 * `priceRange`).
 */
export function pickDefaultVariant(product: any): DefaultVariant | null {
  const vendor = product?.availableAt?.[0];
  const chosen = pickDefaultSizeFrom<any>(vendor?.sizes);
  if (!chosen) return null;
  return {
    size: chosen.size,
    stock: chosen.stock ?? 0,
    price: chosen.pricing?.websitePrice,
    originalPrice: chosen.pricing?.originalWebsitePrice,
    currencySymbol: chosen.pricing?.currencySymbol,
  };
}
