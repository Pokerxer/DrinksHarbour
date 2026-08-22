import { describe, expect, test } from 'vitest';

const { calcPricing, promotedFirst, resolveBestOffer, dealStock } = await import(
  './deal-pricing.ts'
);

const size = (price, original, extra = {}) => ({
  size: '75cl',
  stock: 12,
  pricing: { websitePrice: price, originalWebsitePrice: original },
  ...extra,
});

describe('calcPricing', () => {
  test('reads the discounted size, not position [0][0]', () => {
    const pricing = calcPricing({
      _id: 'p1',
      availableAt: [
        {
          sizes: [
            size(5000, 5000),
            size(3000, 4000, {
              discount: { hasDiscount: true, savings: 1000, percentage: 25 },
            }),
          ],
        },
      ],
    });

    expect(pricing.currentPrice).toBe(3000);
    expect(pricing.discountPercent).toBe(25);
  });

  /**
   * This is where FeaturedDeals and FlashSale genuinely differ, and why the two
   * ports are separate modules: this one calls a price cut a discount even when
   * no `discount` object says so. Collapsing them would change what the cards
   * show on the web's own data.
   */
  test('a bare price gap counts as a discount even with no discount object', () => {
    const pricing = calcPricing({ _id: 'p1', availableAt: [{ sizes: [size(3000, 4000)] }] });

    expect(pricing.hasDiscount).toBe(true);
    expect(pricing.discountPercent).toBe(25);
    expect(pricing.fixedAmountOff).toBe(1000);
  });

  test('a zero price is never discounted', () => {
    expect(calcPricing({ _id: 'p1', availableAt: [{ sizes: [size(0, 4000)] }] }).hasDiscount).toBe(
      false
    );
  });

  test('flags flash_sale and fixed from the offer saleType', () => {
    const flash = calcPricing({
      _id: 'p1',
      availableAt: [{ saleType: 'flash_sale', sizes: [size(3000, 4000)] }],
    });
    const fixed = calcPricing({
      _id: 'p2',
      availableAt: [{ saleType: 'fixed', sizes: [size(3000, 4000)] }],
    });

    expect(flash.isFlashSale).toBe(true);
    expect(fixed.isFixed).toBe(true);
  });

  test('a server-supplied savings wins over the subtraction', () => {
    const pricing = calcPricing({
      _id: 'p1',
      availableAt: [
        { sizes: [size(3000, 4000, { discount: { hasDiscount: true, savings: 950 } })] },
      ],
    });

    expect(pricing.fixedAmountOff).toBe(950);
  });

  test('falls back to priceRange.min with no offers', () => {
    expect(calcPricing({ _id: 'p1', priceRange: { min: 2500 } }).currentPrice).toBe(2500);
  });

  test('an empty product does not throw', () => {
    expect(calcPricing({ _id: 'p1' }).currentPrice).toBe(0);
  });
});

describe('promotedFirst', () => {
  const plain = (id) => ({ _id: id, availableAt: [{ sizes: [size(4000, 4000)] }] });
  const promo = (id) => ({ _id: id, availableAt: [{ sizes: [size(3000, 4000)] }] });

  test('real deals lead the grid whatever order the API returned', () => {
    expect(promotedFirst([plain('a'), promo('b'), plain('c')]).map((p) => p._id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  /**
   * The index tiebreak is the point: without it a non-stable sort could
   * reshuffle equally-promoted products between renders, and the grid would
   * visibly churn on every refresh.
   */
  test('is stable — within a group the API order survives', () => {
    expect(
      promotedFirst([promo('a'), promo('b'), promo('c'), plain('d'), plain('e')]).map(
        (p) => p._id
      )
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('a missing list is an empty list', () => {
    expect(promotedFirst(null)).toEqual([]);
  });
});

describe('resolveBestOffer / dealStock', () => {
  test('the stock shown is the winning size’s, not the first size’s', () => {
    const product = {
      _id: 'p1',
      availableAt: [
        {
          sizes: [
            size(5000, 5000, { stock: 99 }),
            size(3000, 4000, {
              stock: 4,
              discount: { hasDiscount: true, savings: 1000 },
            }),
          ],
        },
      ],
    };

    expect(resolveBestOffer(product).size.stock).toBe(4);
    expect(dealStock(product)).toBe(4);
  });

  test('with nothing discounted it reports the first size', () => {
    expect(dealStock({ _id: 'p1', availableAt: [{ sizes: [size(4000, 4000)] }] })).toBe(12);
  });

  test('a product with no offers reports undefined, not 0', () => {
    // 0 would render "Out of Stock"; undefined lets the status default sensibly.
    expect(dealStock({ _id: 'p1' })).toBeUndefined();
  });
});
