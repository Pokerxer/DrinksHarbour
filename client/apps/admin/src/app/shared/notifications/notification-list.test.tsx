// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NotificationList from './notification-list';
import NotificationCenter from './notification-center';
vi.mock('./use-notification-inbox', () => ({
  useNotificationInbox: () => ({
    data: { notifications: [], total: 0, unreadCount: 0, page: 1, limit: 20 },
    loading: false,
    error: '',
    busy: false,
    refresh: vi.fn(),
    scope: 'test',
    busyLabel: '',
    markManyRead: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));
afterEach(cleanup);
const notice = {
  _id: 'a',
  type: 'low_stock_alert',
  title: 'Wine running low',
  message: 'Wine: 5 units available.',
  isRead: false,
  priority: 'high',
  createdAt: '2026-10-08T08:00:00Z',
  metadata: { periodStart: '2026-10-01', periodEnd: '2026-10-08' },
  actionUrl: '/inventory/stock',
  actionLabel: 'Review stock',
};
it('renders evidence, real action link, unread state and mark-one button', () => {
  const mark = vi.fn();
  render(
    <NotificationList
      notifications={[notice]}
      loading={false}
      error=""
      busy={false}
      onRetry={vi.fn()}
      onRead={mark}
    />
  );
  expect(screen.getByText(notice.message)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Review stock' }).getAttribute('href')
  ).toBe('/inventory/stock');
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  expect(mark).toHaveBeenCalledWith('a');
});
it('supports error, loading and empty states; unsafe action links absent', () => {
  const retry = vi.fn();
  const { rerender } = render(
    <NotificationList
      notifications={[]}
      loading={false}
      error="Network failed"
      busy={false}
      onRetry={retry}
      onRead={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalled();
  rerender(
    <NotificationList
      notifications={[]}
      loading
      error=""
      busy={false}
      onRetry={retry}
      onRead={vi.fn()}
    />
  );
  expect(screen.getByRole('status')).toBeTruthy();
  rerender(
    <NotificationList
      notifications={[]}
      loading={false}
      error=""
      busy={false}
      onRetry={retry}
      onRead={vi.fn()}
    />
  );
  expect(screen.getByText('You’re all caught up')).toBeTruthy();
  rerender(
    <NotificationList
      notifications={[{ ...notice, actionUrl: '//evil.test' }]}
      loading={false}
      error=""
      busy={false}
      onRetry={retry}
      onRead={vi.fn()}
    />
  );
  expect(screen.queryByRole('link')).toBeNull();
});
it('full inbox has category and unread filters and real mark-all action', () => {
  render(<NotificationCenter />);
  expect(
    screen.getByRole('tablist', { name: 'Notification category' })
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Unread only' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeTruthy();
});
it('malformed historical evidence dates do not crash the inbox', () => {
  render(
    <NotificationList
      notifications={[
        { ...notice, metadata: { periodStart: 'bad', periodEnd: 'bad' } },
      ]}
      loading={false}
      error=""
      busy={false}
      onRetry={vi.fn()}
      onRead={vi.fn()}
    />
  );
  expect(screen.getByText(notice.message)).toBeTruthy();
});
