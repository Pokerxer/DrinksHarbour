import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ sessions: new Map<string, unknown>(), orders: [] as Record<string, unknown>[], current: null as unknown }));
vi.mock('./db', () => ({ posDb: {
  session: { put: async (row: { _id: string }) => { state.sessions.set(row._id, row); }, get: async (key: string) => state.sessions.get(key), delete: async (key: string) => { state.sessions.delete(key); } },
  orders: { bulkPut: async (rows: Record<string, unknown>[]) => { state.orders.push(...rows); }, orderBy: () => ({ reverse: () => ({ toArray: async () => state.orders }) }) },
  offlineQueue: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
} }));
vi.mock('../api', () => ({ posApi: { getSessionInfo: async () => ({ currentSession: state.current }), getAllOrders: async () => [{ _id: 'order-a' }] } }));
vi.mock('./image-cache', () => ({ catalogueImageKeys: () => [], POS_IMAGES_UPDATED: 'test' }));
vi.mock('./image-store', () => ({ precacheImages: async () => ({}), pruneImages: async () => {} }));
import { getSessionInfo, getAllOrders } from './api';
beforeEach(() => { state.sessions.clear(); state.orders = []; vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => vi.unstubAllGlobals());
test('offline session comes from the same login and shop and a closed session clears its cache', async () => {
  state.current = { _id: 'session-a', terminalType: 'retail', openedAt: '2026-09-14', orderCount: 1, totalSales: 100 };
  expect((await getSessionInfo('token-a', 'shop-a'))?.sessionId).toBe('session-a');
  vi.stubGlobal('navigator', { onLine: false });
  expect(await getSessionInfo('token-a', 'shop-b')).toBeNull();
  expect(await getSessionInfo('token-b', 'shop-a')).toBeNull();
  expect((await getSessionInfo('token-a', 'shop-a'))?.sessionId).toBe('session-a');
  vi.stubGlobal('navigator', { onLine: true }); state.current = null;
  await getSessionInfo('token-a', 'shop-a');
  vi.stubGlobal('navigator', { onLine: false });
  expect(await getSessionInfo('token-a', 'shop-a')).toBeNull();
});
test('offline order history cannot display another shop or login cache', async () => {
  await getAllOrders('token-a', 'shop-a');
  vi.stubGlobal('navigator', { onLine: false });
  expect(await getAllOrders('token-a', 'shop-a')).toHaveLength(1);
  expect(await getAllOrders('token-a', 'shop-b')).toEqual([]);
  expect(await getAllOrders('token-b', 'shop-a')).toEqual([]);
});
