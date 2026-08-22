import { describe, expect, test } from 'vitest';

const { getBestSale, isFlashSaleSection, withDiscountFirst, formatSoldCount, stockInfoOf } =
  await import('./flash-sale.ts');

const size = (price, original, extra = {}) => ({
  size: '75cl',
  stock: 20,
  pricing: { websitePrice: price, originalWebsitePrice: original },
  ...extra,
});

const discounted = (price, original, savings, extra = {}) =>
  size(price, original, {
    discount: { hasDiscount: true, savings, percentage: 25, originalPrice: original, ...extra },
  });

describe('getBestSale', () => {
  /**
   * The whole reason this scan exists: the backend attaches the discount to the
   * SIZE that is on sale, which is not necessarily availableAt[0].sizes[0].
   * Reading position [0][0] would price the card off an undiscounted size while
   * the badge advertised a discount that is not in the number below it.
   */
  test('picks the discounted size even when it is not the first one', () => {
    const sale = getBestSale({
      _id: 'p1',
      availableAt: [{ sizes: [size(5000, 5000), discounted(3000, 4000, 1000)] }],
    });

    expect(sale.hasDiscount).toBe(true);
    expect(sale.currentPrice).toBe(3000);
    expect(sale.originalPrice).toBe(4000);
  });

  test('picks the LARGEST saving across every tenant offer', () => {
    const sale = getBestSale({
      _id: 'p1',
      availableAt: [
        { sizes: [discounted(4500, 5000, 500)] },
        { sizes: [discounted(3000, 5000, 2000)] },
      ],
    });

    expect(sale.currentPrice).toBe(3000);
  });

  test('carries the offer saleType and end date from the winning offer', () => {
    const sale = getBestSale({
      _id: 'p1',
      availableAt: [
        { saleType: 'percentage', sizes: [discounted(4500, 5000, 500)] },
        { saleType: 'flash_sale', saleEndDate: '2026-09-01T00:00:00.000Z', sizes: [discounted(3000, 5000, 2000)] },
      ],
    });

    expect(sale.saleType).toBe('flash_sale');
    expect(sale.saleEndDate).toBe('2026-09-01T00:00:00.000Z');
  });

  test('a server-supplied discount label wins over the computed percentage', () => {
    const sale = getBestSale({
      _id: 'p1',
      availableAt: [{ sizes: [discounted(3000, 4000, 1000, { label: 'BUY 2 GET 1' })] }],
    });

    expect(sale.discountLabel).toBe('BUY 2 GET 1');
  });
});

describe('getBestSale — no discounted size', () => {
  test('falls back to the first size and still derives a discount from the prices', () => {
    const sale = getBestSale({ _id: 'p1', availableAt: [{ sizes: [size(3000, 4000)] }] });

    expect(sale.hasDiscount).toBe(true);
    expect(sale.discountPct).toBe(25);
  });

  test('equal prices mean no discount', () => {
    const sale = getBestSale({ _id: 'p1', availableAt: [{ sizes: [size(4000, 4000)] }] });

    expect(sale.hasDiscount).toBe(false);
    expect(sale.discountPct).toBe(0);
  });

  // A ₦0 card is worse than no card; the guard is `current > 0`.
  test('a zero price is never "discounted"', () => {
    const sale = getBestSale({ _id: 'p1', availableAt: [{ sizes: [size(0, 4000)] }] });

    expect(sale.hasDiscount).toBe(false);
  });

  test('with no offers at all it falls back to priceRange.min', () => {
    const sale = getBestSale({ _id: 'p1', priceRange: { min: 2500 } });

    expect(sale.currentPrice).toBe(2500);
    expect(sale.hasDiscount).toBe(false);
  });

  test('an empty product does not throw', () => {
    expect(getBestSale({ _id: 'p1' }).currentPrice).toBe(0);
  });
});

describe('isFlashSaleSection', () => {
  test('one flash_sale offer anywhere titles the whole section', () => {
    expect(
      isFlashSaleSection([
        { _id: 'a', availableAt: [{ saleType: 'percentage' }] },
        { _id: 'b', availableAt: [{ saleType: 'flash_sale' }] },
      ])
    ).toBe(true);
  });

  test('no flash_sale offer means "On Sale Now"', () => {
    expect(isFlashSaleSection([{ _id: 'a', availableAt: [{ saleType: 'fixed' }] }])).toBe(false);
  });

  test('a missing list is not a flash sale', () => {
    expect(isFlashSaleSection(null)).toBe(false);
  });
});

describe('withDiscountFirst', () => {
  const withDiscount = { _id: 'a', availableAt: [{ sizes: [discounted(3000, 4000, 1000)] }] };
  const without = { _id: 'b', availableAt: [{ sizes: [size(4000, 4000)] }] };

  test('keeps only genuinely discounted products when there are some', () => {
    expect(withDiscountFirst([withDiscount, without]).map((p) => p._id)).toEqual(['a']);
  });

  // The rail must never be empty for a formatting reason.
  test('falls back to the whole payload when none are discounted', () => {
    expect(withDiscountFirst([without]).map((p) => p._id)).toEqual(['b']);
  });

  test('a missing list is an empty list, not a throw', () => {
    expect(withDiscountFirst(undefined)).toEqual([]);
  });
});

describe('formatSoldCount', () => {
  test('abbreviates at a thousand', () => {
    expect(formatSoldCount(1200)).toBe('1.2k');
    expect(formatSoldCount(1000)).toBe('1.0k');
  });

  test('leaves smaller counts alone', () => {
    expect(formatSoldCount(999)).toBe('999');
  });
});

describe('stockInfoOf', () => {
  test('returns the flat stockInfo the list endpoints publish', () => {
    expect(stockInfoOf({ _id: 'p', stockInfo: { totalStock: 40, availableStock: 12 } })).toEqual({
      totalStock: 40,
      availableStock: 12,
    });
  });

  test('a product with no stockInfo yields an empty object, not undefined', () => {
    expect(stockInfoOf({ _id: 'p' })).toEqual({});
  });
});
