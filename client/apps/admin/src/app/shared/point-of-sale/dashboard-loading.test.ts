import { afterEach, expect, test, vi } from 'vitest';
import { posApi } from './api';

afterEach(() => vi.unstubAllGlobals());

test('the back-office overview explicitly requests all shops despite a saved shop selection', async () => {
  let requested = '';
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'dh-pos-tenant'
    ? '{"_id":"tenant"}' : '{"tenant":"previous-shop"}' });
  vi.stubGlobal('fetch', async (url: string) => {
    requested = url;
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  });
  await posApi.getDashboard('admin-token', 'all');
  expect(new URL(requested).searchParams.get('shopId')).toBe('all');
});
