import { beforeEach, describe, expect, test, vi } from 'vitest';

let lastPath = null;
let lastInit = null;

vi.mock('./api-client.ts', () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import('./api-client.ts');
const cartApi = await import('./cart-api.ts');

const res = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function reply(status, body) {
  apiFetch.mockImplementationOnce(async (path, init) => {
    lastPath = path;
    lastInit = init;
    return res(status, body);
  });
}

/**
 * `server/helpers/cart.helpers.js:buildCartLine` is what the server actually
 * emits — the client's own line shape, with a `cartItemId` the helper's comment
 * requires to stay byte-identical to the web's `generateCartItemId`. This is
 * that shape, not an invented one.
 */
const SERVER_LINE = {
  cartItemId: 'prod1-70cl-Wyn City-default',
  _id: 'prod1',
  id: 'prod1',
  name: 'Lagavulin 16',
  slug: 'lagavulin-16',
  images: [{ url: 'https://cdn/lag.jpg' }],
  selectedProductId: 'prod1',
  selectedSubProductId: 'sub1',
  selectedSizeId: 'size70',
  selectedVendorId: 'ten1',
  selectedVendor: 'Wyn City',
  selectedSize: '70cl',
  selectedColor: '',
  price: 52000,
  packUnitPrice: null,
  packThreshold: null,
  quantity: 2,
  addedAt: 1000,
};

const EXPECTED_LINE = {
  cartItemId: 'prod1-70cl-Wyn City-default',
  productId: 'prod1',
  slug: 'lagavulin-16',
  name: 'Lagavulin 16',
  imageUrl: 'https://cdn/lag.jpg',
  subProductId: 'sub1',
  sizeId: 'size70',
  tenantId: 'ten1',
  vendorName: 'Wyn City',
  size: '70cl',
  quantity: 2,
  price: 52000,
  packUnitPrice: null,
  packThreshold: null,
  addedAt: 1000,
};

beforeEach(() => {
  lastPath = null;
  lastInit = null;
  vi.clearAllMocks();
});

describe('fetchServerCart', () => {
  test('reads the lines out of data.cart.items', async () => {
    reply(200, { success: true, data: { cart: { items: [SERVER_LINE], subtotal: 104000 } } });

    expect(await cartApi.fetchServerCart()).toEqual({ ok: true, data: [EXPECTED_LINE] });
    expect(lastPath).toBe('/api/cart');
  });

  test('an empty stored cart is an empty list, not an error', async () => {
    reply(200, { success: true, data: { cart: { items: [], isEmpty: true } } });

    expect(await cartApi.fetchServerCart()).toEqual({ ok: true, data: [] });
  });

  test('a failure is an error result, not a throw', async () => {
    reply(500, { success: false, message: 'Failed to fetch cart' });

    expect(await cartApi.fetchServerCart()).toEqual({ ok: false, error: 'Failed to fetch cart' });
  });

  test('drops a line the server could no longer identify', async () => {
    // buildCartLine returns null for a deleted product / delisted tenant, but a
    // proxy or an older build could still hand us something shapeless.
    reply(200, { success: true, data: { cart: { items: [SERVER_LINE, {}, null] } } });

    expect((await cartApi.fetchServerCart()).data).toEqual([EXPECTED_LINE]);
  });

  test('reads a bare-string image', async () => {
    reply(200, {
      success: true,
      data: { cart: { items: [{ ...SERVER_LINE, images: ['https://cdn/plain.jpg'] }] } },
    });

    expect((await cartApi.fetchServerCart()).data[0].imageUrl).toBe('https://cdn/plain.jpg');
  });
});

describe('saveServerCart', () => {
  test('POSTs the server payload to /save', async () => {
    reply(200, { success: true, data: { cart: { items: [SERVER_LINE] }, results: {} } });

    const result = await cartApi.saveServerCart([EXPECTED_LINE]);

    expect(result.ok).toBe(true);
    expect(lastPath).toBe('/api/cart/save');
    expect(lastInit.method).toBe('POST');
    expect(JSON.parse(lastInit.body).items[0]).toMatchObject({
      subProductId: 'sub1',
      sizeId: 'size70',
      quantity: 2,
    });
  });
});

describe('mergeServerCart', () => {
  test('POSTs to /merge and returns the merged lines', async () => {
    reply(200, { success: true, data: { cart: { items: [SERVER_LINE] } } });

    expect(await cartApi.mergeServerCart([EXPECTED_LINE])).toEqual({ ok: true, data: [EXPECTED_LINE] });
    expect(lastPath).toBe('/api/cart/merge');
  });
});

describe('validateServerCart', () => {
  test('POSTs to /validate and keys the verdicts by subProduct + size', async () => {
    reply(200, {
      success: true,
      data: {
        items: [
          { subProductId: 'sub1', sizeId: 'size70', status: 'ok', available: true, currentPrice: 52000 },
          { subProductId: 'sub2', sizeId: null, status: 'out_of_stock', available: false, currentPrice: 0 },
        ],
      },
    });

    const result = await cartApi.validateServerCart([EXPECTED_LINE]);

    expect(lastPath).toBe('/api/cart/validate');
    expect(result.data['sub1-size70'].status).toBe('ok');
    expect(result.data['sub2-'].available).toBe(false);
  });

  test('an empty cart never reaches the network — the server 400s on it', async () => {
    expect(await cartApi.validateServerCart([])).toEqual({ ok: true, data: {} });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe('clearServerCart', () => {
  test('DELETEs /api/cart', async () => {
    reply(200, { success: true, data: {} });

    expect((await cartApi.clearServerCart()).ok).toBe(true);
    expect(lastPath).toBe('/api/cart');
    expect(lastInit.method).toBe('DELETE');
  });
});
