// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNotificationInbox } from './use-notification-inbox';
import * as service from '@/services/notification.service';
let user = { id: 'a', tenantId: 'a', token: 'a' };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user } }),
}));
const notice = (id: string) => ({
  _id: id,
  type: 'low_stock_alert',
  title: id,
  message: 'Low',
  priority: 'high',
  isRead: false,
  createdAt: '2026-10-08',
  metadata: {},
});
const page = (ids: string[], total = ids.length, unreadCount = total) => ({
  notifications: ids.map(notice),
  total,
  unreadCount,
  page: 1,
  limit: 50,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  user = { id: 'a', tenantId: 'a', token: 'a' };
});
it('loads at most ten pages and deduplicates the bounded window', async () => {
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockImplementation(async (_token, path) =>
      page(
        Array.from({ length: 50 }, (_, i) =>
          String(
            (Number(new URLSearchParams(path?.slice(1)).get('page')) - 1) * 49 +
              i
          )
        ),
        700
      )
    );
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(request).toHaveBeenCalledTimes(10);
  expect(result.current.data.notifications).toHaveLength(491);
  expect(result.current.data.total).toBe(700);
});
it('retains partial pages after a network failure', async () => {
  vi.spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce(page(['a'], 60))
    .mockRejectedValueOnce(Error('Offline'));
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.error).toBe('Offline'));
  expect(result.current.data.notifications[0]._id).toBe('a');
});
it('optimistically reads once and rolls back on failure', async () => {
  let reject!: (error: Error) => void;
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce(page(['a']))
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        })
    );
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.data.total).toBe(1));
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.markRead('a');
    void result.current.markRead('a');
  });
  expect(result.current.data.notifications[0].isRead).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => {
    reject(Error('Read failed'));
    await pending;
  });
  expect(result.current.data.unreadCount).toBe(1);
  expect(result.current.data.notifications[0].isRead).toBe(false);
});
it('subtracts modifiedCount and publishes the shared event identity', async () => {
  vi.spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce(page(['a'], 1, 5))
    .mockResolvedValueOnce({ modifiedCount: 3 });
  const listener = vi.fn();
  window.addEventListener('drinksharbour:notifications-changed', listener);
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.data.total).toBe(1));
  await act(() => result.current.markAllRead());
  expect(result.current.data.unreadCount).toBe(2);
  expect(listener.mock.calls[0][0].detail).toBe('a:a');
  window.removeEventListener('drinksharbour:notifications-changed', listener);
});
it('aborts on unmount and discards responses from the previous tenant', async () => {
  let finish!: (value: ReturnType<typeof page>) => void;
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        })
    )
    .mockResolvedValueOnce(page(['b']));
  const { result, rerender, unmount } = renderHook(() =>
    useNotificationInbox()
  );
  const firstSignal = request.mock.calls[0][2]?.signal;
  user = { id: 'b', tenantId: 'b', token: 'b' };
  rerender();
  expect(result.current.data.notifications).toEqual([]);
  await waitFor(() =>
    expect(result.current.data.notifications[0]?._id).toBe('b')
  );
  await act(async () => finish(page(['a'])));
  expect(firstSignal?.aborted).toBe(true);
  expect(result.current.data.notifications[0]._id).toBe('b');
  const lastSignal = request.mock.calls[1][2]?.signal;
  unmount();
  expect(lastSignal?.aborted).toBe(true);
});
it('stops selected read operations at the first failure and reports progress', async () => {
  vi.spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce(page(['a', 'b', 'c']))
    .mockResolvedValueOnce({ isRead: true })
    .mockRejectedValueOnce(Error('Offline'));
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.data.total).toBe(3));
  await act(() => result.current.markManyRead(['a', 'b', 'c']));
  expect(result.current.data.notifications.map((n) => n.isRead)).toEqual([
    true,
    false,
    false,
  ]);
  expect(result.current.error).toContain('1 of 3');
});
it('shows sign-in guidance without making requests when the token is absent', async () => {
  user = { id: 'a', tenantId: 'a', token: '' };
  const request = vi.spyOn(service, 'notificationRequest');
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('Sign in to view notifications.');
  expect(request).not.toHaveBeenCalled();
});
it('ignores other-tenant change events and refreshes this tenant while visible', async () => {
  const request = vi
    .spyOn(service, 'notificationRequest')
    .mockResolvedValue(page(['a']));
  const { result } = renderHook(() => useNotificationInbox());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent('drinksharbour:notifications-changed', { detail: 'b:b' })
    )
  );
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent('drinksharbour:notifications-changed', { detail: 'a:a' })
    )
  );
  expect(request).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(request).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(request).toHaveBeenCalledTimes(3);
});
