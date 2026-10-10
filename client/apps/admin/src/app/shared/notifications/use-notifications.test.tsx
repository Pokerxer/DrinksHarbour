// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNotifications } from './use-notifications';
import * as service from '@/services/notification.service';
let user = { id: 'a', tenantId: 'a', token: 'a' };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user } }),
}));
const response = (title: string) => ({
  notifications: [
    {
      _id: title,
      type: 'low_stock_alert',
      title,
      message: '5 left',
      priority: 'high',
      isRead: false,
      createdAt: '2026-10-08',
      metadata: {},
    },
  ],
  total: 1,
  unreadCount: 1,
  page: 1,
  limit: 20,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  user = { id: 'a', tenantId: 'a', token: 'a' };
});
it('sends product decision filters to the server and reloads when the decision changes', async () => {
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockResolvedValue(response('decision'));
  const { rerender } = renderHook(
    ({ type }) => useNotifications({ category: 'products', type }),
    {
      initialProps: {
        type: 'product_rejected' as 'product_rejected' | 'product_approved',
      },
    }
  );
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(request.mock.lastCall?.[1]).toContain('type=product_rejected');
  rerender({ type: 'product_approved' });
  await waitFor(() =>
    expect(request.mock.lastCall?.[1]).toContain('type=product_approved')
  );
});
it('does not apply an old response after authentication scope changes', async () => {
  let finish!: (data: ReturnType<typeof response>) => void;
  vi.spyOn(service, 'notificationRequest')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(response('B'));
  const { result, rerender } = renderHook(() => useNotifications());
  user = { id: 'b', tenantId: 'b', token: 'b' };
  rerender();
  expect(result.current.data.notifications).toEqual([]);
  await waitFor(() =>
    expect(result.current.data.notifications[0]?.title).toBe('B')
  );
  await act(async () => finish(response('A')));
  expect(result.current.data.notifications[0].title).toBe('B');
});
it('read mutation failure leaves unread count intact and reports the error', async () => {
  vi.spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce(response('A'))
    .mockRejectedValueOnce(Error('Read failed'));
  const { result } = renderHook(() => useNotifications());
  await waitFor(() => expect(result.current.data.unreadCount).toBe(1));
  await act(() => result.current.markAllRead());
  expect(result.current.data.unreadCount).toBe(1);
  expect(result.current.error).toBe('Read failed');
});
it('stops polling while hidden and refreshes when visible', async () => {
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockResolvedValue(response('A'));
  const { result } = renderHook(() => useNotifications());
  await waitFor(() => expect(result.current.data.total).toBe(1));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  document.dispatchEvent(new Event('visibilitychange'));
  const count = request.mock.calls.length;
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(request.mock.calls.length).toBeGreaterThan(count);
});
it('sends search and sorting to the server and discards prior search responses', async () => {
  let finish!: (data: ReturnType<typeof response>) => void;
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(response('new result'));
  const { result, rerender } = renderHook(
    ({ search }) =>
      useNotifications({ category: 'products', search, sort: 'oldest' }),
    { initialProps: { search: 'old' } }
  );
  rerender({ search: 'wine [2019]' });
  await waitFor(() =>
    expect(result.current.data.notifications[0]?.title).toBe('new result')
  );
  const query = new URLSearchParams(String(request.mock.calls[1][1]).slice(1));
  expect(query.get('search')).toBe('wine [2019]');
  expect(query.get('sort')).toBe('oldest');
  expect(query.get('category')).toBe('products');
  await act(async () => finish(response('old result')));
  expect(result.current.data.notifications[0].title).toBe('new result');
});
it('applies inclusive date filters on the server and scopes bulk reads to the range', async () => {
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockResolvedValue(response('A'));
  const { result } = renderHook(() =>
    useNotifications({ startDate: '2026-09-01', endDate: '2026-09-30' })
  );
  await waitFor(() => expect(result.current.data.total).toBe(1));
  const query = new URLSearchParams(String(request.mock.calls[0][1]).slice(1));
  expect(query.get('startDate')).toBe('2026-09-01');
  expect(query.get('endDate')).toBe('2026-09-30');
  await act(() => result.current.markAllRead());
  expect(request.mock.calls[1][1]).toBe(
    '/read-all?startDate=2026-09-01&endDate=2026-09-30'
  );
});
