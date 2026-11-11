import type { ProductType } from '@/types/product.types';
import { purchaseLimits } from '../Product/Detail/purchase-quantity';
import { resolveOfferVolume } from '@/utils/offerVolume';

type Seller = NonNullable<ProductType['availableAt']>[number];
type Size = Seller['sizes'][number] & {
  displayName?: string;
  colorName?: string;
  optionName?: string;
  volumeMl?: number;
  availableStock?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  availability?: string;
  inStock?: boolean;
  pricing: Seller['sizes'][number]['pricing'] & { currency?: string };
};
export interface Offer {
  product: ProductType;
  seller: Seller;
  size: Size;
  price: number;
  volume: number | undefined;
}

export const productId = (product: ProductType) => product._id || product.id;

export function purchasableOffers(product: ProductType): Offer[] {
  if (!productId(product) || !product.slug) return [];
  return (product.availableAt ?? []).flatMap(seller => {
    if (!seller._id || !seller.tenant?._id || !seller.tenant.name) return [];
    return (seller.sizes ?? []).flatMap((size: Size) => {
      const price = size.pricing?.websitePrice;
      const limits = purchaseLimits(size);
      if (!size._id || !size.size || !limits.canBuy || limits.min > 1 ||
          !Number.isFinite(price) || price <= 0 ||
          (size.pricing.currency && size.pricing.currency !== 'NGN')) return [];
      return [{ product, seller, size, price, volume: resolveOfferVolume(size) }];
    });
  });
}

type OfferFilter = { requiredSeller?: boolean; min?: number; max?: number };

export function pickOffer(
  products: ProductType[],
  sellerIds: string[],
  options: OfferFilter = {},
) {
  const isSameSeller = (offer: Offer) => sellerIds.includes(offer.seller.tenant._id);
  return products.flatMap(purchasableOffers)
    .filter(offer => (!options.requiredSeller || isSameSeller(offer)) &&
      offer.price >= (options.min ?? 0) && offer.price <= (options.max ?? Infinity))
    .sort((a, b) => Number(isSameSeller(b)) - Number(isSameSeller(a)) || a.price - b.price)[0];
}

export async function findLiveOffer(
  candidates: ProductType[],
  sellers: string[],
  load: (slug: string) => Promise<ProductType | null>,
  signal: AbortSignal,
  filter?: OfferFilter,
) {
  let remaining = candidates;
  for (let attempt = 0; attempt < 3 && !signal.aborted; attempt += 1) {
    const candidate = pickOffer(remaining, sellers, filter);
    if (!candidate) return undefined;
    const id = productId(candidate.product);
    remaining = remaining.filter(product => productId(product) !== id);
    const current = await load(candidate.product.slug).catch(() => null);
    if (!current || signal.aborted || productId(current) !== id) continue;
    const offer = pickOffer([current], sellers, filter);
    if (offer) return offer;
  }
  return undefined;
}

export function offerIdentity(offer: Offer) {
  return [productId(offer.product), offer.seller._id, offer.size._id].join(':');
}

export function offerHref(offer: Offer) {
  const query = new URLSearchParams({ seller: offer.seller._id, size: offer.size._id });
  return `/product/${encodeURIComponent(offer.product.slug)}?${query}`;
}

export function money(amount: number) {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export interface DeliveryQuote {
  fee: number;
  remaining: number;
  firstOrderPerk?: { reason: string; minSubtotal: number; maxWaiver: number };
}

export function deliveryOpportunity(quote: DeliveryQuote | null, subtotal: number) {
  if (!quote || !Number.isFinite(quote.fee) || quote.fee <= 0) return null;
  const perk = quote.firstOrderPerk;
  const firstOrderGap = perk?.reason === 'below_minimum' ? perk.minSubtotal - subtotal : 0;
  const options = [
    { gap: quote.remaining, saving: quote.fee, label: 'free delivery' },
    { gap: firstOrderGap, saving: Math.min(quote.fee, perk?.maxWaiver ?? 0), label: 'your first-order delivery discount' },
  ];
  return options.filter(option => Number.isFinite(option.gap) && option.gap > 0 &&
    Number.isFinite(option.saving) && option.saving > 0 &&
    option.gap <= Math.max(option.saving * 2, subtotal * 0.1))
    .sort((a, b) => a.gap - b.gap || b.saving - a.saving)[0] ?? null;
}
