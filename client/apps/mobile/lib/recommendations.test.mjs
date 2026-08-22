import { describe, expect, test } from 'vitest';

const { isPublishedProduct, isProductNew, totalStockOf, toRecommendedCardView, toRecommendedCardViews } =
  await import('./recommendations.ts');

const NOW = Date.parse('2026-08-19T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const base = (extra = {}) => ({ _id: 'p1', slug: 'malbec', name: 'Malbec', ...extra });

const priced = (websitePrice, originalWebsitePrice, extra = {}) => ({
  sizes: [{ size: '75cl', stock: 10, pricing: { websitePrice, originalWebsitePrice } }],
  ...extra,
});

describe('isPublishedProduct', () => {
  test('an explicit unpublished status hides the product', () => {
    for (const status of ['draft', 'pending', 'rejected', 'archived', 'discontinued']) {
      expect(isPublishedProduct({ status })).toBe(false);
    }
  });

  test('isPublished:false hides it', () => {
    expect(isPublishedProduct({ isPublished: false })).toBe(false);
  });

  // A leaner API payload must not hide legitimate products.
  test('absent flags are treated as published', () => {
    expect(isPublishedProduct({ _id: 'p' })).toBe(true);
  });

  test('null is not a product', () => {
    expect(isPublishedProduct(null)).toBe(false);
  });
});

describe('totalStockOf', () => {
  /**
   * This is load-bearing, not cosmetic. The section filters on stock > 0, and
   * trending/bestsellers publish the count as a FLAT `totalStock`. Reading only
   * `stockInfo.totalStock` would filter every product out and render "Nothing
   * here yet" over a completely healthy payload.
   */
  test('reads the flat totalScore the list endpoints publish', () => {
    expect(totalStockOf({ totalStock: 40 })).toBe(40);
  });

  test('falls back to availability.totalStock, then stockInfo.totalStock', () => {
    expect(totalStockOf({ availability: { totalStock: 25 } })).toBe(25);
    expect(totalStockOf({ stockInfo: { totalStock: 7 } })).toBe(7);
  });

  test('nothing known is zero', () => {
    expect(totalStockOf({ _id: 'p' })).toBe(0);
    expect(totalStockOf(null)).toBe(0);
  });
});

describe('toRecommendedCardView — price', () => {
  test('a server-computed price gap shows the strike-through', () => {
    const view = toRecommendedCardView(base({ availableAt: [priced(3000, 4000)] }), NOW);

    expect(view.price).toBe(3000);
    expect(view.originalPrice).toBe(4000);
    expect(view.showStrikethrough).toBe(true);
  });

  test('no gap means no strike-through and a null original', () => {
    const view = toRecommendedCardView(base({ availableAt: [priced(4000, 4000)] }), NOW);

    expect(view.showStrikethrough).toBe(false);
    expect(view.originalPrice).toBeNull();
  });

  /**
   * The client-side fallback: when the server did NOT compute the discount, the
   * card applies the raw sale value itself — but only inside the sale's own
   * date window, so an expired promotion cannot keep discounting.
   */
  test('applies a percentage sale the server left uncomputed', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [
          priced(5000, 5000, {
            isOnSale: true,
            saleType: 'percentage',
            saleDiscountValue: 20,
            saleEndDate: new Date(NOW + DAY).toISOString(),
          }),
        ],
      }),
      NOW
    );

    expect(view.price).toBe(4000);
    expect(view.showStrikethrough).toBe(true);
  });

  test('applies a fixed sale as a subtraction, floored at zero', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [
          priced(5000, 5000, { isOnSale: true, saleType: 'fixed', saleDiscountValue: 1500 }),
        ],
      }),
      NOW
    );

    expect(view.price).toBe(3500);
  });

  test('an EXPIRED sale is not applied', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [
          priced(5000, 5000, {
            isOnSale: true,
            saleDiscountValue: 20,
            saleEndDate: new Date(NOW - DAY).toISOString(),
          }),
        ],
      }),
      NOW
    );

    expect(view.price).toBe(5000);
    expect(view.showStrikethrough).toBe(false);
  });

  test('a sale that has not STARTED is not applied', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [
          priced(5000, 5000, {
            isOnSale: true,
            saleDiscountValue: 20,
            saleStartDate: new Date(NOW + DAY).toISOString(),
          }),
        ],
      }),
      NOW
    );

    expect(view.price).toBe(5000);
  });
});

describe('toRecommendedCardView — badge ranking', () => {
  const saleOffer = (saleType) =>
    priced(3000, 4000, { isOnSale: true, saleType, saleDiscountValue: 25 });

  test('flash_sale outranks everything', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [saleOffer('flash_sale')],
        badge: { name: 'Award Winner', color: '#123456' },
      }),
      NOW
    );

    expect(view.badge).toBe('flash_sale');
  });

  test('a fixed sale renders an amount, not a percentage', () => {
    const view = toRecommendedCardView(
      base({
        availableAt: [
          priced(5000, 5000, { isOnSale: true, saleType: 'fixed', saleDiscountValue: 1500 }),
        ],
      }),
      NOW
    );

    expect(view.badge).toBe('fixed');
    expect(view.badgeLabel).toBe('-₦1,500');
  });

  test('the product badge shows only when there is no sale at all', () => {
    const view = toRecommendedCardView(
      base({ availableAt: [priced(4000, 4000)], badge: { name: 'Award Winner' } }),
      NOW
    );

    expect(view.badge).toBe('product_badge');
    expect(view.badgeLabel).toBe('AWARD WINNER');
    // The web defaults an uncoloured badge to emerald rather than transparent.
    expect(view.badgeColor).toBe('#10B981');
  });

  test('no sale and no badge is no badge', () => {
    expect(toRecommendedCardView(base({ availableAt: [priced(4000, 4000)] }), NOW).badge).toBeNull();
  });
});

describe('toRecommendedCardView — the rest', () => {
  test('a product with no slug is dropped', () => {
    expect(toRecommendedCardView({ _id: 'p1', name: 'No slug' }, NOW)).toBeNull();
  });

  test('out of stock is driven by the resolved total stock', () => {
    expect(toRecommendedCardView(base({ totalStock: 0 }), NOW).isOutOfStock).toBe(true);
    expect(toRecommendedCardView(base({ totalStock: 3 }), NOW).isOutOfStock).toBe(false);
  });

  test('isNew uses a 7-day window, or the new-arrival badge', () => {
    expect(isProductNew(new Date(NOW - 6 * DAY).toISOString(), NOW)).toBe(true);
    expect(isProductNew(new Date(NOW - 8 * DAY).toISOString(), NOW)).toBe(false);
    expect(toRecommendedCardView(base({ badge: { type: 'new-arrival' } }), NOW).isNew).toBe(true);
  });

  test('abv and origin are null when absent, never 0 or ""', () => {
    const view = toRecommendedCardView(base({ abv: 0, originCountry: '' }), NOW);

    expect(view.abv).toBeNull();
    expect(view.origin).toBeNull();
  });

  test('region wins over originCountry, matching the web card', () => {
    expect(
      toRecommendedCardView(base({ region: 'Mendoza', originCountry: 'Argentina' }), NOW).origin
    ).toBe('Mendoza');
  });
});

describe('toRecommendedCardViews', () => {
  test('drops unpublished and out-of-stock, then caps at maxItems', () => {
    const views = toRecommendedCardViews(
      [
        base({ _id: 'a', slug: 'a', totalStock: 5 }),
        base({ _id: 'b', slug: 'b', totalStock: 0 }),
        base({ _id: 'c', slug: 'c', totalStock: 5, status: 'draft' }),
        base({ _id: 'd', slug: 'd', totalStock: 5 }),
      ],
      NOW,
      1
    );

    expect(views.map((v) => v.id)).toEqual(['a']);
  });

  test('a missing list is an empty list', () => {
    expect(toRecommendedCardViews(null, NOW, 12)).toEqual([]);
  });
});
