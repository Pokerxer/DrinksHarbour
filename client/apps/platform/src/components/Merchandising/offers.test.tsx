import { expect, it } from 'vitest';
import type { ProductType } from '@/types/product.types';
import { deliveryOpportunity, findLiveOffer, offerIdentity, pickOffer, purchasableOffers } from './offers';

function product(overrides: Partial<NonNullable<ProductType['availableAt']>[number]['sizes'][number]> & {
  availableStock?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
} = {}): ProductType {
  return {
    id: 'mixer', name: 'Tonic Water', slug: 'tonic-water', type: 'mixer', price: 1000,
    availableAt: [
      {
        _id: 'listing-a', tenant: { _id: 'a', name: 'Seller A', slug: 'a' },
        sizes: [{ _id: 'size-a', size: '25cl', stock: 3, pricing: { websitePrice: 1200 }, ...overrides }],
      },
      {
        _id: 'listing-b', tenant: { _id: 'b', name: 'Seller B', slug: 'b' },
        sizes: [{ _id: 'size-b', size: '25cl', stock: 3, pricing: { websitePrice: 1000 } }],
      },
    ],
  };
}

it('prefers the current seller and identifies the exact listing and size', () => {
  const offer = pickOffer([product()], ['a']);
  expect(offer?.price).toBe(1200);
  expect(offer && offerIdentity(offer)).toBe('mixer:listing-a:size-a');
  expect(pickOffer([product()], ['a'], { requiredSeller: true, min: 1000, max: 1100 })).toBeUndefined();
});

it.each([
  { availableStock: 0 },
  { minOrderQuantity: 2 },
  { maxOrderQuantity: 0 },
  { pricing: { websitePrice: 0 } },
])('omits invalid one-unit offers %j', overrides => {
  expect(purchasableOffers(product(overrides)).map(offer => offer.size._id)).toEqual(['size-b']);
});

it('uses the actual quote and avoids distant or already-free delivery thresholds', () => {
  expect(deliveryOpportunity(null, 48_000)).toBeNull();
  expect(deliveryOpportunity({ fee: 0, remaining: 500 }, 48_000)).toBeNull();
  expect(deliveryOpportunity({ fee: 2500, remaining: 1_952_000 }, 48_000)).toBeNull();
  expect(deliveryOpportunity({ fee: 2500, remaining: 1000 }, 1_999_000))
    .toEqual({ gap: 1000, saving: 2500, label: 'free delivery' });
});

it('uses the first-order minimum and caps savings at the actual fee', () => {
  const firstOrderPerk = { reason: 'below_minimum', minSubtotal: 50_000, maxWaiver: 5000 };
  expect(deliveryOpportunity({ fee: 2500, remaining: 1_952_000, firstOrderPerk }, 48_000))
    .toEqual({ gap: 2000, saving: 2500, label: 'your first-order delivery discount' });
  expect(deliveryOpportunity({ fee: 2500, remaining: 1_952_000,
    firstOrderPerk: { ...firstOrderPerk, reason: 'outside_zone' } }, 48_000)).toBeNull();
});

it('uses the next suitable seller offer when the first product is no longer sellable', async () => {
  const first = { ...product(), id: 'first', slug: 'first' };
  const second = { ...product(), id: 'second', slug: 'second' };
  const result = await findLiveOffer([first, second], ['a'],
    async slug => slug === 'first' ? null : second, new AbortController().signal, { requiredSeller: true });
  expect(result && offerIdentity(result)).toBe('second:listing-a:size-a');
});
