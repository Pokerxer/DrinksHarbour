import { ProductType } from '@/types/product.types';

/**
 * Resolve a product's display selling price from the richest source available.
 * The product-detail endpoint (getProductBySlug) returns no top-level `price`,
 * only `priceRange` and `availableAt[].sizes[].pricing.websitePrice`, so a
 * naive read of `product.price` yields ₦0 for refreshed/compared items. Order:
 *   1. positive top-level `price`
 *   2. `priceRange.min`
 *   3. smallest positive `availableAt[].sizes[].pricing.websitePrice`
 */
export const resolveProductPrice = (p: any): number => {
  if (typeof p?.price === 'number' && p.price > 0) return p.price;
  if (typeof p?.priceRange?.min === 'number' && p.priceRange.min > 0) return p.priceRange.min;
  const sizePrices: number[] = Array.isArray(p?.availableAt)
    ? p.availableAt
        .flatMap((v: any) => (Array.isArray(v?.sizes) ? v.sizes : []))
        .map((s: any) => s?.pricing?.websitePrice)
        .filter((n: any) => typeof n === 'number' && n > 0)
    : [];
  if (sizePrices.length) return Math.min(...sizePrices);
  return typeof p?.price === 'number' ? p.price : 0;
};

/**
 * Resolve the strike-through "was" price. Prefers an explicit `originPrice`,
 * then the largest per-size `originalWebsitePrice` when it beats the selling
 * price. Returns undefined when there is no genuine discount to show.
 */
export const resolveProductOriginPrice = (p: any): number | undefined => {
  if (typeof p?.originPrice === 'number' && p.originPrice > 0) return p.originPrice;
  const origins: number[] = Array.isArray(p?.availableAt)
    ? p.availableAt
        .flatMap((v: any) => (Array.isArray(v?.sizes) ? v.sizes : []))
        .map((s: any) => s?.pricing?.originalWebsitePrice)
        .filter((n: any) => typeof n === 'number' && n > 0)
    : [];
  const selling = resolveProductPrice(p);
  const best = origins.length ? Math.max(...origins) : 0;
  return best > selling ? best : undefined;
};

export const calculateDiscountPercentage = (price: number, originPrice?: number): number => {
  if (!originPrice || originPrice <= price) return 0;
  return Math.floor(100 - (price / originPrice) * 100);
};

export const calculateSoldPercentage = (sold: number, quantity: number): number => {
  if (quantity <= 0) return 0;
  return Math.floor((sold / quantity) * 100);
};

export const isNewProduct = (createdAt: string | Date): boolean => {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  return now - created < sevenDaysInMs;
};

export const formatPrice = (price: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};
