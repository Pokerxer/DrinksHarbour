import { beforeEach, afterEach, expect, test, vi } from 'vitest';
beforeEach(() => vi.stubGlobal('navigator', { onLine: true }));
afterEach(() => vi.unstubAllGlobals());

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('./db', () => ({ posDb: {
  products: {
    toArray: async () => state.rows,
    clear: async () => { state.rows = []; },
    bulkPut: async (rows: Record<string, unknown>[]) => { state.rows = rows; },
  },
  stockAdjust: { toArray: async () => [] },
  transaction: async (_mode: string, _table: unknown, work: () => Promise<void>) => work(),
} }));
vi.mock('../api', () => ({ posApi: { getProducts: async () => ({
  products: [{ _id: 'bottle', availableStock: 4, product: { name: 'Bottle' } }],
}) } }));
vi.mock('./image-cache', () => ({ catalogueImageKeys: () => [], POS_IMAGES_UPDATED: 'test' }));
vi.mock('./image-store', () => ({ precacheImages: async () => ({ failed: 0, fetched: 0 }), pruneImages: async () => {} }));

import { getProducts, getProductsWithLocalStock } from './api';

test('offline catalogue cannot cross POS or login contexts', async () => {
  await getProducts('tenant-a-session', 'shop-a');
  expect(await getProductsWithLocalStock('tenant-a-session', 'shop-a')).toHaveLength(1);
  expect(await getProductsWithLocalStock('tenant-a-session', 'shop-b')).toEqual([]);
  expect(await getProductsWithLocalStock('tenant-b-session', 'shop-a')).toEqual([]);
});

test('refresh removes previously cached products that left the location', async () => {
  state.rows = [{ _id: 'old-bottle', availableStock: 10 }];
  await getProducts('tenant-a-session', 'shop-a');
  expect(state.rows.map(row => row._id)).toEqual(['bottle']);
});
