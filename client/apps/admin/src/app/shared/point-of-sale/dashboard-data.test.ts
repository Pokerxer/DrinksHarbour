import { afterEach, expect, test, vi } from 'vitest';
import { posApi } from './api';
import { loadDashboardData } from './dashboard-data';

afterEach(() => vi.restoreAllMocks());

test('loads session cards for shops returned by this request, without cached shops', async () => {
  vi.spyOn(posApi, 'getDashboard').mockResolvedValue({} as Awaited<ReturnType<typeof posApi.getDashboard>>);
  vi.spyOn(posApi, 'listShops').mockResolvedValue({ shops: [{ _id: 'fresh-shop', name: 'Fresh shop', mode: 'retail', active: true, createdAt: '', color: '#000', description: '' }] });
  vi.spyOn(posApi, 'getSessionInfo').mockImplementation(async (_token, _mode, shopId) => ({
    currentSession: shopId === 'fresh-shop' ? { _id: 'fresh-session' } as never : null,
    lastSession: null,
  }));
  const data = await loadDashboardData('token', 'all');
  expect(data.sessions['fresh-shop'].currentSession?._id).toBe('fresh-session');
  expect(data.sessions.retail.currentSession).toBeNull();
  expect(data.errors).toEqual([]);
});

test('failed session status stays unknown and exposes the error instead of marking a shop closed', async () => {
  vi.spyOn(posApi, 'getDashboard').mockRejectedValue(new Error('Overview unavailable'));
  vi.spyOn(posApi, 'listShops').mockResolvedValue({ shops: [] });
  vi.spyOn(posApi, 'getSessionInfo').mockRejectedValue(new Error('Session unavailable'));
  const data = await loadDashboardData('token', 'all');
  expect(data.dashboard).toBeNull();
  expect(data.sessions.retail).toBeUndefined();
  expect(data.errors).toEqual(['Overview: Overview unavailable', 'Retail session: Session unavailable']);
});
