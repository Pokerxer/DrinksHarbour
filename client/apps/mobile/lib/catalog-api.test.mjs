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
    // The SEARCH endpoint with the filter, not /api/products/featured — that is
    // the query apps/platform/src/app/page.tsx:87 runs, and the only one that
    // returns the `isFeatured` flag the card layer re-checks.
    expect(lastPath).toBe('/api/products?isFeatured=true&limit=8');
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
    expect(lastPath).toBe('/api/banners/placement/home_hero?limit=5');
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
  // The whole banner is passed through now, not a four-field summary: the web
  // hero and PlacementBanner read ctaStyle, contentPosition, overlayOpacity,
  // textColor, priority and autoplay.interval, and a summary would silently
  // flatten every one of those to a default.
  test('passes the banner through with its presentation fields intact', async () => {
    reply(200, {
      success: true,
      data: [
        {
          _id: 'b1',
          title: 'Festive',
          image: { url: 'https://x/b.jpg' },
          ctaStyle: 'outline',
          contentPosition: 'bottom-left',
          overlayOpacity: 40,
          priority: 'urgent',
        },
      ],
    });

    const result = await catalog.fetchBanners('home_secondary', 1);

    expect(result.ok).toBe(true);
    expect(result.data[0]).toMatchObject({
      _id: 'b1',
      title: 'Festive',
      ctaStyle: 'outline',
      contentPosition: 'bottom-left',
      overlayOpacity: 40,
      priority: 'urgent',
    });
    expect(lastPath).toBe('/api/banners/placement/home_secondary?limit=1');
  });

  test('bannerImageUrl resolves an image object, a bare string, or nothing', async () => {
    expect(catalog.bannerImageUrl({ _id: 'b1', title: '', image: { url: 'https://x/a.jpg' } }))
      .toBe('https://x/a.jpg');
    expect(catalog.bannerImageUrl({ _id: 'b2', title: '', image: 'https://x/b.jpg' }))
      .toBe('https://x/b.jpg');
    expect(catalog.bannerImageUrl({ _id: 'b3', title: '' })).toBeNull();
  });

  // mobileImage wins when the API set one — it is the crop cut for this screen.
  test('bannerImageUrl prefers mobileImage over the desktop image', () => {
    expect(
      catalog.bannerImageUrl({
        _id: 'b1',
        title: '',
        image: { url: 'https://x/wide.jpg' },
        mobileImage: { url: 'https://x/tall.jpg' },
      })
    ).toBe('https://x/tall.jpg');
  });

  // Phase 3 dropped these. It should not have: both web components fall back to
  // `backgroundColor` and still render their copy and CTA, so dropping a banner
  // with no artwork loses a working promotion.
  test('a banner with no image is KEPT — the web falls back to backgroundColor', async () => {
    reply(200, {
      success: true,
      data: [{ _id: 'b1', title: 'No art', backgroundColor: '#7C1D1D', ctaText: 'Shop' }],
    });

    const result = await catalog.fetchBanners('home_hero');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].backgroundColor).toBe('#7C1D1D');
  });

  test('a banner with no _id is dropped — it has no tracking identity', async () => {
    reply(200, { success: true, data: [{ title: 'Orphan' }] });

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

describe('searchProducts', () => {
  // `/api/products/search`, NOT `/api/products?search=`. Measured against the
  // running backend on 2026-08-19: the `search` query param on the plain list
  // endpoint is IGNORED — "medoc", "zzzzznonsense" and an empty string all
  // returned the identical default page. Only this endpoint matches across
  // country, region, appellation, producer, vintage, cask, style and notes.
  test('queries the real search endpoint with the term encoded', async () => {
    reply(200, {
      success: true,
      data: { products: [PRODUCT], pagination: { totalResults: 1, currentPage: 1, totalPages: 1 } },
    });

    const result = await catalog.searchProducts('rosé wine');

    expect(result).toEqual({
      ok: true,
      data: { products: [PRODUCT], total: 1, page: 1, totalPages: 1 },
    });
    expect(lastPath).toBe('/api/products/search?q=ros%C3%A9%20wine&page=1&limit=8');
  });

  test('carries the pagination the count strip renders', async () => {
    reply(200, {
      success: true,
      data: {
        products: [PRODUCT],
        pagination: { totalResults: 215, currentPage: 2, totalPages: 27, resultsPerPage: 8 },
      },
    });

    const result = await catalog.searchProducts('smoky', { page: 2 });

    expect(result.data).toEqual({ products: [PRODUCT], total: 215, page: 2, totalPages: 27 });
    expect(lastPath).toBe('/api/products/search?q=smoky&page=2&limit=8');
  });

  test('falls back when the envelope carries no pagination', async () => {
    // ModalSearchContext.tsx:302-307 does the same — total defaults to the
    // number of products actually returned, never to 0.
    reply(200, { success: true, data: { products: [PRODUCT, PRODUCT] } });

    expect((await catalog.searchProducts('gin')).data).toEqual({
      products: [PRODUCT, PRODUCT],
      total: 2,
      page: 1,
      totalPages: 1,
    });
  });

  test('an empty term never reaches the network', async () => {
    // The web modal shows its default panel until something is typed.
    const result = await catalog.searchProducts('   ');

    expect(result).toEqual({ ok: true, data: { products: [], total: 0, page: 1, totalPages: 0 } });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('a zero-result query is a success, not an error', async () => {
    // Reachable for the first time: the old endpoint could not return 0.
    reply(200, {
      success: true,
      data: { products: [], pagination: { totalResults: 0, currentPage: 1, totalPages: 0 } },
    });

    expect(await catalog.searchProducts('zzzzznonsense')).toEqual({
      ok: true,
      data: { products: [], total: 0, page: 1, totalPages: 0 },
    });
  });

  test('a failure is an error result, not a throw', async () => {
    reply(500, { success: false, message: 'Search is down' });

    expect(await catalog.searchProducts('gin')).toEqual({ ok: false, error: 'Search is down' });
  });

  test('an explicit limit is honoured', async () => {
    reply(200, { success: true, data: { products: [] } });

    await catalog.searchProducts('rum', { limit: 20 });

    expect(lastPath).toBe('/api/products/search?q=rum&page=1&limit=20');
  });
});

describe('fetchSearchSuggestions', () => {
  // `{ success, data: [...] }` — a bare array of names, verified live:
  // `q=whi&limit=8` returned 8 whisky names.
  test('returns the suggestion strings', async () => {
    reply(200, { success: true, data: ['Akashi Blended Whisky', 'Armorik Classic Whisky'] });

    const result = await catalog.fetchSearchSuggestions('whi');

    expect(result).toEqual({ ok: true, data: ['Akashi Blended Whisky', 'Armorik Classic Whisky'] });
    expect(lastPath).toBe('/api/products/suggestions?q=whi&limit=8');
  });

  test('a term under two characters never reaches the network', async () => {
    // ModalSearchContext.tsx:420 — the web bails below length 2.
    expect(await catalog.fetchSearchSuggestions('w')).toEqual({ ok: true, data: [] });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('drops anything that is not a string', async () => {
    reply(200, { success: true, data: ['Gin', null, 42, 'Rum'] });

    expect((await catalog.fetchSearchSuggestions('gi')).data).toEqual(['Gin', 'Rum']);
  });

  test('a failure is an error result, not a throw', async () => {
    reply(503, { success: false, message: 'Suggestions are down' });

    expect(await catalog.fetchSearchSuggestions('gin')).toEqual({
      ok: false,
      error: 'Suggestions are down',
    });
  });
});
