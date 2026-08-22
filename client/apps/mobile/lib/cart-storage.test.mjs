import { beforeEach, describe, expect, test, vi } from 'vitest';

const store = new Map();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn(async (k, v) => void store.set(k, v)),
    removeItem: vi.fn(async (k) => void store.delete(k)),
  },
}));

const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
const { loadCart, saveCart, dropCart } = await import('./cart-storage.ts');
const { storageKeyFor, CART_EXPIRY_DAYS } = await import('./cart-core.ts');

const LINE = {
  cartItemId: 'prod1-70cl-Wyn City-default',
  productId: 'prod1',
  slug: 'lagavulin-16',
  name: 'Lagavulin 16',
  imageUrl: null,
  subProductId: 'sub1',
  sizeId: 'size70',
  tenantId: 'ten1',
  vendorName: 'Wyn City',
  size: '70cl',
  quantity: 1,
  price: 52000,
  packUnitPrice: null,
  packThreshold: null,
  addedAt: 1000,
};

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('saveCart / loadCart', () => {
  test('round-trips under the per-identity key', async () => {
    await saveCart('u1', [LINE], 5000);

    expect(AsyncStorage.setItem.mock.calls[0][0]).toBe(storageKeyFor('u1'));
    expect(await loadCart('u1', 5000)).toEqual([LINE]);
  });

  test('a guest cart and a user cart do not see each other', async () => {
    await saveCart(null, [LINE], 5000);

    expect(await loadCart('u1', 5000)).toEqual([]);
    expect(await loadCart(null, 5000)).toEqual([LINE]);
  });

  test('nothing stored reads as an empty cart', async () => {
    expect(await loadCart('u1', 5000)).toEqual([]);
  });
});

describe('expiry', () => {
  test('a cart inside the window survives', async () => {
    await saveCart('u1', [LINE], 0);

    expect(await loadCart('u1', 6 * DAY)).toEqual([LINE]);
  });

  test('a cart past the window is dropped AND erased', async () => {
    await saveCart('u1', [LINE], 0);

    expect(await loadCart('u1', (CART_EXPIRY_DAYS + 1) * DAY)).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(storageKeyFor('u1'));
  });
});

describe('corruption', () => {
  test('unparseable JSON reads as an empty cart', async () => {
    store.set(storageKeyFor('u1'), 'not json');

    expect(await loadCart('u1', 5000)).toEqual([]);
  });

  test('a payload with no lines array reads as an empty cart', async () => {
    store.set(storageKeyFor('u1'), JSON.stringify({ savedAt: 1 }));

    expect(await loadCart('u1', 5000)).toEqual([]);
  });

  test('individual lines missing their ids are dropped, the rest kept', async () => {
    // A line without both ids cannot be saved or validated; keeping it would
    // show the shopper something they can never check out.
    store.set(
      storageKeyFor('u1'),
      JSON.stringify({ savedAt: 5000, lines: [LINE, { ...LINE, sizeId: '' }, null, 'x'] })
    );

    expect(await loadCart('u1', 5000)).toEqual([LINE]);
  });
});

describe('when the device store fails', () => {
  test('loadCart degrades to an empty cart', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_FULL'));

    expect(await loadCart('u1', 5000)).toEqual([]);
  });

  test('saveCart swallows the failure — the server copy is the durable one', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('quota'));

    await expect(saveCart('u1', [LINE], 5000)).resolves.toBeUndefined();
  });
});

describe('dropCart', () => {
  test('erases only that identity', async () => {
    await saveCart('u1', [LINE], 5000);
    await saveCart(null, [LINE], 5000);

    await dropCart('u1');

    expect(await loadCart('u1', 5000)).toEqual([]);
    expect(await loadCart(null, 5000)).toEqual([LINE]);
  });
});
