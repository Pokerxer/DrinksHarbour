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

/**
 * Whether the page will render as in stock — the single rule behind the
 * `product:availability` meta tag and the JSON-LD Offer's `availability`.
 *
 * Mirrors the Detail component exactly, which derives its visible
 * "✓ In Stock" / "✗ Out of Stock" badge from the selected size alone
 * (`(selectedSizeData?.stock || 0) > 0`). A product with no vendor sizes has
 * nothing to select, so the shopper sees "Out of Stock" and the markup must
 * say the same.
 *
 * This replaced `p.availability !== "out_of_stock" && p.status !== "out_of_stock"`,
 * which never once evaluated false: `availability` is an object
 * (`{ status, stockLevel, ... }`), so comparing it to a string is always true,
 * and `status` carries the moderation state ("approved"), not stock. Every
 * variant-less product therefore advertised `in stock` to Google and Merchant
 * Center while the page itself said the opposite.
 */
export function isDefaultVariantInStock(product: any): boolean {
  return (pickDefaultVariant(product)?.stock ?? 0) > 0;
}
