import { describe, expect, test } from 'vitest';

const {
  filterFeatured,
  mapFeaturedProduct,
  mapFeaturedProducts,
  featuredStats,
  isSizeOutOfStock,
  priceForSize,
} = await import('./featured-product.ts');

const NOW = Date.parse('2026-08-19T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const base = (extra = {}) => ({
  _id: 'p1',
  slug: 'malbec',
  name: 'Malbec',
  isFeatured: true,
  ...extra,
});

describe('filterFeatured', () => {
  /**
   * Defense in depth: `?isFeatured=true` is a server filter, and if it ever
   * stops being applied this section silently becomes a second "all products"
   * grid rather than a curated one.
   */
  test('keeps only products the API flagged', () => {
    expect(
      filterFeatured([
        { _id: 'a', isFeatured: true },
        { _id: 'b', isFeatured: false },
        { _id: 'c' },
      ]).map((p) => p._id)
    ).toEqual(['a']);
  });

  test('accepts the string "true" — the flag arrives serialised sometimes', () => {
    expect(filterFeatured([{ _id: 'a', isFeatured: 'true' }])).toHaveLength(1);
  });

  test('a missing list is an empty list', () => {
    expect(filterFeatured(undefined)).toEqual([]);
  });
});

describe('mapFeaturedProduct', () => {
  test('a product with no slug is dropped — the card would push /product/undefined', () => {
    expect(mapFeaturedProduct({ _id: 'p1', name: 'No slug' }, NOW)).toBeNull();
  });

  test('trusts the server sale flag and applies the discount to the price', () => {
    const view = mapFeaturedProduct(
      base({
        sale: true,
        availableAt: [
          {
            saleDiscountValue: 20,
            isOnSale: true,
            sizes: [{ size: '75cl', pricing: { websitePrice: 5000 } }],
          },
        ],
      }),
      NOW
    );

    expect(view.sale).toBe(true);
    expect(view.discount).toBe(20);
    expect(view.price).toBe(4000);
  });

  test('derives the discount from the prices when the server sent no flag', () => {
    const view = mapFeaturedProduct(
      base({
        availableAt: [
          {
            sizes: [
              { size: '75cl', pricing: { websitePrice: 3000, originalWebsitePrice: 4000 } },
            ],
          },
        ],
      }),
      NOW
    );

    expect(view.sale).toBe(true);
    expect(view.discount).toBe(25);
  });

  test('takes the LARGER of the server value and the derived percentage', () => {
    const view = mapFeaturedProduct(
      base({
        availableAt: [
          {
            saleDiscountValue: 10,
            isOnSale: true,
            sizes: [
              { size: '75cl', pricing: { websitePrice: 3000, originalWebsitePrice: 4000 } },
            ],
          },
        ],
      }),
      NOW
    );

    expect(view.discount).toBe(25);
  });

  /**
   * A product with tenant offers but no per-offer counters must not read "Out of
   * Stock" — the sold-out veil would cover a perfectly buyable grid.
   */
  test('offers with no stock counters fall back to 100, not 0', () => {
    const view = mapFeaturedProduct(base({ availableAt: [{ sizes: [] }] }), NOW);

    expect(view.totalStock).toBe(100);
  });

  test('a product with no offers at all really is out of stock', () => {
    expect(mapFeaturedProduct(base(), NOW).totalStock).toBe(0);
  });

  test('sums stock across every tenant offer', () => {
    const view = mapFeaturedProduct(
      base({ availableAt: [{ totalStock: 12 }, { totalStock: 30 }] }),
      NOW
    );

    expect(view.totalStock).toBe(42);
  });

  test('isNew uses a 30-day window', () => {
    expect(
      mapFeaturedProduct(base({ createdAt: new Date(NOW - 29 * DAY).toISOString() }), NOW).isNew
    ).toBe(true);
    expect(
      mapFeaturedProduct(base({ createdAt: new Date(NOW - 31 * DAY).toISOString() }), NOW).isNew
    ).toBe(false);
  });

  test('an unparseable createdAt is not new, and does not throw', () => {
    expect(mapFeaturedProduct(base({ createdAt: 'whenever' }), NOW).isNew).toBe(false);
  });

  test('falls back through primaryImage then images[0]', () => {
    expect(mapFeaturedProduct(base({ images: [{ url: 'https://x/a.jpg' }] }), NOW).imageUrl).toBe(
      'https://x/a.jpg'
    );
    expect(
      mapFeaturedProduct(
        base({ primaryImage: { url: 'https://x/p.jpg' }, images: [{ url: 'https://x/a.jpg' }] }),
        NOW
      ).imageUrl
    ).toBe('https://x/p.jpg');
    expect(mapFeaturedProduct(base(), NOW).imageUrl).toBeNull();
  });
});

describe('featuredStats', () => {
  test('counts DISTINCT tenants across every product', () => {
    const stats = featuredStats([
      { averageRating: 4, tenantKeys: ['t1', 't2'] },
      { averageRating: 5, tenantKeys: ['t2', 't3'] },
    ]);

    expect(stats.tenantsCount).toBe(3);
    expect(stats.count).toBe(2);
    expect(stats.avgRating).toBe(4.5);
  });

  // A 0/0 mean is NaN, and NaN.toFixed(1) renders the literal string "NaN".
  test('an empty list yields zeroes, never NaN', () => {
    expect(featuredStats([])).toEqual({ count: 0, avgRating: 0, tenantsCount: 0 });
  });
});

describe('isSizeOutOfStock / priceForSize', () => {
  test('an explicit inStock:false is sold out even with units listed', () => {
    expect(isSizeOutOfStock({ stock: 10, inStock: false })).toBe(true);
  });

  test('a non-positive stock is sold out', () => {
    expect(isSizeOutOfStock({ stock: 0 })).toBe(true);
    expect(isSizeOutOfStock({ stock: 1 })).toBe(false);
  });

  // An absent size is "unknown", not "sold out" — it must not grey the card.
  test('a missing size is not sold out', () => {
    expect(isSizeOutOfStock(null)).toBe(false);
  });

  test('a size with no pricing falls back to the mapped price', () => {
    expect(priceForSize(null, 2500)).toEqual({ price: 2500, originPrice: 2500 });
  });

  test('a live size price wins over the fallback', () => {
    expect(
      priceForSize({ pricing: { websitePrice: 3000, originalWebsitePrice: 4000 } }, 2500)
    ).toEqual({ price: 3000, originPrice: 4000 });
  });
});

describe('mapFeaturedProducts', () => {
  test('filters, maps, and drops the unusable in one pass', () => {
    const views = mapFeaturedProducts(
      [
        { _id: 'a', slug: 'a', isFeatured: true },
        { _id: 'b', slug: 'b', isFeatured: false },
        { _id: 'c', isFeatured: true },
      ],
      NOW
    );

    expect(views.map((v) => v._id)).toEqual(['a']);
  });
});
