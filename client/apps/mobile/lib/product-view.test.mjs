import { describe, expect, test } from 'vitest';

const { productImageUrl, toProductCardView, toProductCardViews } = await import('./product-view.ts');

/** A product shaped the way the server actually returns it. */
const product = (overrides = {}) => ({
  _id: 'p1',
  slug: 'malbec',
  name: 'Catena Malbec',
  availableAt: [
    {
      sizes: [
        { size: '75cl', stock: 4, pricing: { websitePrice: 18000, originalWebsitePrice: 24000 } },
      ],
    },
  ],
  ...overrides,
});

describe('productImageUrl', () => {
  test('prefers primaryImage.url', () => {
    const result = productImageUrl(
      product({ primaryImage: { url: 'https://x/primary.jpg' }, images: [{ url: 'https://x/a.jpg' }] })
    );

    expect(result).toBe('https://x/primary.jpg');
  });

  test('falls back to the first images[] entry', () => {
    const result = productImageUrl(product({ images: [{ url: 'https://x/a.jpg' }] }));

    expect(result).toBe('https://x/a.jpg');
  });

  // Neither field is guaranteed. This is why RemoteImage must have a placeholder.
  test('returns null when neither field carries a url', () => {
    expect(productImageUrl(product())).toBeNull();
  });

  test('an empty primaryImage.url does not shadow images[]', () => {
    const result = productImageUrl(
      product({ primaryImage: { url: '' }, images: [{ url: 'https://x/a.jpg' }] })
    );

    expect(result).toBe('https://x/a.jpg');
  });

  test('an empty images array is not an index crash', () => {
    expect(productImageUrl(product({ images: [] }))).toBeNull();
  });
});

describe('toProductCardView', () => {
  test('derives price and originalPrice from the default variant', () => {
    const view = toProductCardView(product());

    expect(view).toMatchObject({
      id: 'p1',
      slug: 'malbec',
      name: 'Catena Malbec',
      price: 18000,
      originalPrice: 24000,
      inStock: true,
    });
  });

  test('computes a rounded discount percentage', () => {
    const view = toProductCardView(product());

    // 24000 -> 18000 is 25% off.
    expect(view.discountPct).toBe(25);
  });

  test('no originalPrice means no discount badge', () => {
    const view = toProductCardView(
      product({
        availableAt: [{ sizes: [{ size: '75cl', stock: 2, pricing: { websitePrice: 18000 } }] }],
      })
    );

    expect(view.discountPct).toBeNull();
  });

  test('an originalPrice at or below price is not a discount', () => {
    const view = toProductCardView(
      product({
        availableAt: [
          {
            sizes: [
              { size: '75cl', stock: 2, pricing: { websitePrice: 18000, originalWebsitePrice: 18000 } },
            ],
          },
        ],
      })
    );

    expect(view.discountPct).toBeNull();
  });

  // pickDefaultVariant returns the first IN-STOCK size, not the first size —
  // the rule the web product page and the JSON-LD Offer already share.
  test('prices the first in-stock size, not the cheapest sold-out one', () => {
    const view = toProductCardView(
      product({
        availableAt: [
          {
            sizes: [
              { size: '5cl', stock: 0, pricing: { websitePrice: 2000 } },
              { size: '75cl', stock: 6, pricing: { websitePrice: 18000 } },
            ],
          },
        ],
      })
    );

    expect(view.price).toBe(18000);
    expect(view.inStock).toBe(true);
  });

  test('every size sold out reads as out of stock but still shows a price', () => {
    const view = toProductCardView(
      product({
        availableAt: [{ sizes: [{ size: '75cl', stock: 0, pricing: { websitePrice: 18000 } }] }],
      })
    );

    expect(view.inStock).toBe(false);
    expect(view.price).toBe(18000);
  });

  // A product with no vendor sizes has no variant; priceRange is the documented
  // fallback (default-variant.ts:31-33).
  test('falls back to priceRange.min when there are no vendor sizes', () => {
    const view = toProductCardView(
      product({ availableAt: [], priceRange: { min: 9500, max: 12000 } })
    );

    expect(view.price).toBe(9500);
    expect(view.inStock).toBe(false);
  });

  test('a product with neither variant nor priceRange has a null price, not zero', () => {
    const view = toProductCardView(product({ availableAt: [] }));

    expect(view.price).toBeNull();
  });

  // A card with no slug cannot be tapped — it would push /product/undefined.
  test('a product with no slug is rejected', () => {
    expect(toProductCardView(product({ slug: undefined }))).toBeNull();
  });

  test('a missing name degrades to an empty string, not "undefined"', () => {
    const view = toProductCardView(product({ name: undefined }));

    expect(view.name).toBe('');
  });
});

describe('toProductCardViews', () => {
  test('drops unrenderable products instead of failing the whole rail', () => {
    const views = toProductCardViews([product(), product({ _id: 'p2', slug: undefined })]);

    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('p1');
  });

  test('a non-array input is an empty list', () => {
    expect(toProductCardViews(undefined)).toEqual([]);
  });
});
