import { beforeEach, describe, expect, test, vi } from 'vitest';

let lastPath = null;

vi.mock('./api-client.ts', () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import('./api-client.ts');
const catalog = await import('./catalog-api.ts');

const res = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Queue one reply for the next apiFetch call, recording the path it was asked for. */
function reply(status, body) {
  apiFetch.mockImplementationOnce(async (path) => {
    lastPath = path;
    return res(status, body);
  });
}

const PRODUCT = { _id: 'p1', slug: 'malbec', name: 'Malbec' };

beforeEach(() => {
  lastPath = null;
  vi.clearAllMocks();
});

describe('envelope normalisation', () => {
  // The three shapes the server actually emits. Verified against
  // controllers/product.controller.js and utils/response.js on 2026-08-18.
  test('reads products from data.products (featured, bestsellers, onSale)', async () => {
    reply(200, { success: true, data: { products: [PRODUCT], pagination: { totalPages: 3 } } });

    const result = await catalog.fetchFeaturedProducts();

    expect(result).toEqual({ ok: true, data: [PRODUCT] });
    expect(lastPath).toBe('/api/products/featured?limit=12');
  });

  test('reads products from data.products when pagination is absent (trending)', async () => {
    reply(200, { success: true, data: { products: [PRODUCT] } });

    const result = await catalog.fetchTrendingProducts();

    expect(result).toEqual({ ok: true, data: [PRODUCT] });
  });

  test('reads a bare array sitting directly in data (banners)', async () => {
    reply(200, { success: true, message: 'Banners fetched', data: [] });

    const result = await catalog.fetchBanners('home_hero');

    expect(result).toEqual({ ok: true, data: [] });
    expect(lastPath).toBe('/api/banners/placement/home_hero');
  });

  test('a payload with no recognisable list is an empty list, not an error', async () => {
    reply(200, { success: true, data: { pagination: {} } });

    const result = await catalog.fetchBestsellers();

    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe('error branches', () => {
  test('a non-2xx status is an error result, never a throw', async () => {
    reply(500, { success: false, message: 'boom' });

    const result = await catalog.fetchTrendingProducts();

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('a rejected fetch is an error result, never a throw', async () => {
    apiFetch.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });

    const result = await catalog.fetchFeaturedProducts();

    expect(result.ok).toBe(false);
  });

  test('a 200 carrying unparseable JSON is an error result', async () => {
    apiFetch.mockImplementationOnce(
      async () => new Response('<html>gateway</html>', { status: 200 })
    );

    const result = await catalog.fetchBestsellers();

    expect(result.ok).toBe(false);
  });
});

describe('fetchFeaturedCategories', () => {
  test('maps categories and picks image.url', async () => {
    reply(200, {
      success: true,
      data: {
        categories: [{ _id: 'c1', name: 'Wine', slug: 'wine', image: { url: 'https://x/w.jpg' } }],
      },
    });

    const result = await catalog.fetchFeaturedCategories();

    expect(result).toEqual({
      ok: true,
      data: [{ _id: 'c1', name: 'Wine', slug: 'wine', image: 'https://x/w.jpg' }],
    });
    expect(lastPath).toBe('/api/categories/featured');
  });

  test('a category with no image maps to a null image, not undefined', async () => {
    reply(200, { success: true, data: { categories: [{ _id: 'c1', name: 'Gin', slug: 'gin' }] } });

    const result = await catalog.fetchFeaturedCategories();

    expect(result.data[0].image).toBeNull();
  });

  // /featured returns [] for a tenant that flagged nothing. An empty rail is a
  // missing rail, so fall back to the full list rather than render nothing.
  test('an empty featured list falls back to /api/categories', async () => {
    reply(200, { success: true, data: { categories: [] } });
    reply(200, { success: true, data: { categories: [{ _id: 'c9', name: 'Beer', slug: 'beer' }] } });

    const result = await catalog.fetchFeaturedCategories();

    expect(result.data).toHaveLength(1);
    expect(lastPath).toBe('/api/categories');
  });

  test('a failing /featured also falls back to /api/categories', async () => {
    reply(500, { success: false });
    reply(200, { success: true, data: { categories: [{ _id: 'c9', name: 'Beer', slug: 'beer' }] } });

    const result = await catalog.fetchFeaturedCategories();

    expect(result.ok).toBe(true);
    expect(lastPath).toBe('/api/categories');
  });

  test('both endpoints failing is an error result', async () => {
    reply(500, { success: false });
    reply(500, { success: false });

    const result = await catalog.fetchFeaturedCategories();

    expect(result.ok).toBe(false);
  });
});

describe('fetchBanners', () => {
  test('maps a banner to title, image and link', async () => {
    reply(200, {
      success: true,
      data: [{ _id: 'b1', title: 'Festive', image: { url: 'https://x/b.jpg' }, linkUrl: '/shop' }],
    });

    const result = await catalog.fetchBanners('home_secondary');

    expect(result.data).toEqual([
      { _id: 'b1', title: 'Festive', image: 'https://x/b.jpg', linkUrl: '/shop' },
    ]);
    expect(lastPath).toBe('/api/banners/placement/home_secondary');
  });

  test('a banner whose image is a bare string still resolves', async () => {
    reply(200, { success: true, data: [{ _id: 'b1', title: 'Festive', image: 'https://x/b.jpg' }] });

    const result = await catalog.fetchBanners('home_hero');

    expect(result.data[0].image).toBe('https://x/b.jpg');
    expect(result.data[0].linkUrl).toBeNull();
  });

  test('banners with no usable image are dropped — a blank hero slide is worse than none', async () => {
    reply(200, { success: true, data: [{ _id: 'b1', title: 'No art' }] });

    const result = await catalog.fetchBanners('home_hero');

    expect(result.data).toEqual([]);
  });
});

describe('fetchOnSaleProducts', () => {
  // The web block calls this exact query string. There is no promotions endpoint.
  test('calls the products search with the onSale filter', async () => {
    reply(200, { success: true, data: { products: [PRODUCT] } });

    await catalog.fetchOnSaleProducts();

    expect(lastPath).toBe('/api/products?onSale=true&limit=20&inStock=false');
  });
});

describe('fetchProductBySlug', () => {
  test('unwraps data.product', async () => {
    reply(200, { success: true, data: { product: PRODUCT } });

    const result = await catalog.fetchProductBySlug('malbec');

    expect(result).toEqual({ ok: true, data: PRODUCT });
    expect(lastPath).toBe('/api/products/slug/malbec');
  });

  test('encodes the slug', async () => {
    reply(200, { success: true, data: { product: PRODUCT } });

    await catalog.fetchProductBySlug('rosé wine');

    expect(lastPath).toBe('/api/products/slug/ros%C3%A9%20wine');
  });

  test('a 404 is an error result carrying a message', async () => {
    reply(404, { success: false, message: 'Product not found' });

    const result = await catalog.fetchProductBySlug('nope');

    expect(result).toEqual({ ok: false, error: 'Product not found' });
  });

  test('a 200 with no product is an error result, not { ok: true, data: undefined }', async () => {
    reply(200, { success: true, data: {} });

    const result = await catalog.fetchProductBySlug('ghost');

    expect(result.ok).toBe(false);
  });
});
