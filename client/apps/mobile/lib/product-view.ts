import { pickDefaultVariant } from 'commerce-core';
import type { RawProduct } from './catalog-api.ts';

/**
 * Everything a product card renders, derived once.
 *
 * Components cannot be unit-tested in this setup (vitest is environment:'node'),
 * so the derivation lives here where it can be. A card component receives a
 * ProductCardView and does nothing but lay it out.
 */

export interface ProductCardView {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  /** Whole-number percent off, or null when there is no genuine discount. */
  discountPct: number | null;
  inStock: boolean;
}

/**
 * Mirrors the web card exactly (Home1/FlashSale.tsx:257). Neither field is
 * guaranteed, so the caller must have a placeholder.
 */
export function productImageUrl(product: RawProduct): string | null {
  const primary = product?.primaryImage?.url;
  if (typeof primary === 'string' && primary) return primary;

  const first = product?.images?.[0]?.url;
  return typeof first === 'string' && first ? first : null;
}

const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export function toProductCardView(product: RawProduct): ProductCardView | null {
  // Without a slug the card has nowhere to navigate — it would push
  // /product/undefined and render a full-screen retry.
  if (!product?._id || typeof product.slug !== 'string' || !product.slug) return null;

  const variant = pickDefaultVariant(product);

  const price = positive(variant?.price) ?? positive(product.priceRange?.min);
  const originalPrice = positive(variant?.originalPrice);

  const discountPct =
    price !== null && originalPrice !== null && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  return {
    id: String(product._id),
    slug: product.slug,
    name: typeof product.name === 'string' ? product.name : '',
    imageUrl: productImageUrl(product),
    price,
    originalPrice: discountPct === null ? null : originalPrice,
    discountPct,
    inStock: (variant?.stock ?? 0) > 0,
  };
}

/** One bad product hides one card, never the whole rail. */
export function toProductCardViews(products: RawProduct[] | undefined | null): ProductCardView[] {
  if (!Array.isArray(products)) return [];
  return products
    .map(toProductCardView)
    .filter((view): view is ProductCardView => view !== null);
}
