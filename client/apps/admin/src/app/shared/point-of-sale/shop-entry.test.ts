import { afterEach, expect, test, vi } from 'vitest';
import { resolveShopEntry, historyAccess } from './shop-entry';
import { posApi } from './api';

afterEach(() => vi.unstubAllGlobals());

test('Wholesale CBL retains its shop identity and wholesale mode', () => {
  expect(resolveShopEntry('cbl-id', [{ _id: 'cbl-id', name: 'Wholesale CBL', mode: 'wholesale', active: true }]))
    .toEqual({ shopId: 'cbl-id', mode: 'wholesale', name: 'Wholesale CBL' });
});
test('missing or inactive shops never fall back to Retail', () => {
  expect(() => resolveShopEntry('missing', [])).toThrow();
  expect(() => resolveShopEntry('cbl-id', [{ _id: 'cbl-id', name: 'CBL', mode: 'wholesale', active: false }])).toThrow();
  expect(resolveShopEntry('retail', []).shopId).toBe('retail');
});
test('back-office history prefers its own login and includes all shops and legacy', () => {
  expect(historyAccess('owner-token', 'cashier-token', 'cbl-id')).toEqual({ token: 'owner-token', defaultShop: 'all' });
  expect(historyAccess(null, 'cashier-token', 'cbl-id')).toEqual({ token: 'cashier-token', defaultShop: 'cbl-id' });
});
test('session opening sends the selected custom shop even when persisted selection is Retail', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(options.body)) as Record<string, unknown> });
    return { ok: true, status: 200, json: async () => ({ success: true, data: { session: { shopId: 'cbl-id' } } }) };
  });
  const entry = resolveShopEntry('cbl-id', [{ _id: 'cbl-id', name: 'Wholesale CBL', mode: 'wholesale' }]);
  await posApi.openSession('cashier-token', 100, entry.mode, undefined, entry.shopId);
  expect(calls[0].body).toMatchObject({ shopId: 'cbl-id', terminalType: 'wholesale' });
  expect(new URL(calls[0].url).searchParams.get('shopId')).toBe('cbl-id');
});
test('history requests use all shops instead of the saved Retail drawer', async () => {
  const urls: string[] = [];
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  });
  const access = historyAccess('owner-token', 'cashier-token', 'retail');
  await posApi.getAllOrders(access.token!, { shopId: access.defaultShop });
  await posApi.getSessions(access.token!, 1, 20, undefined, undefined, undefined, access.defaultShop);
  expect(urls).toHaveLength(2);
  expect(urls.every(url => new URL(url).searchParams.get('shopId') === 'all')).toBe(true);
});
