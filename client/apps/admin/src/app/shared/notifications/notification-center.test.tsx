// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NotificationCenter from './notification-center';
const fixture = vi.hoisted(() => ({
  markRead: vi.fn(),
  markManyRead: vi.fn(),
  refresh: vi.fn(),
  error: '',
  loading: false,
  total: null as number | null,
  notices: [
    {
      _id: 'a',
      type: 'low_stock_alert',
      title: 'Wine running low',
      message: 'Only five bottles left. Arrange more stock.',
      priority: 'normal',
      isRead: false,
      createdAt: '2026-10-08T08:00:00Z',
      metadata: {
        productName: 'Wine',
        currentUnits: 5,
        threshold: 10,
        periodStart: 'bad',
        periodEnd: 'bad',
      },
      actionUrl: '//evil.test',
      actionLabel: 'Open',
    },
  ],
}));
const initialNotices = fixture.notices;
vi.mock('./use-notification-inbox', () => ({
  useNotificationInbox: () => ({
    scope: 'test',
    data: {
      notifications: fixture.notices,
      total: fixture.total ?? fixture.notices.length,
      unreadCount: fixture.notices.filter((n) => !n.isRead).length,
    },
    error: fixture.error,
    loading: fixture.loading,
    busy: false,
    busyLabel: '',
    refresh: fixture.refresh,
    markRead: fixture.markRead,
    markManyRead: fixture.markManyRead,
    markAllRead: vi.fn(),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  fixture.error = '';
  fixture.loading = false;
  fixture.total = null;
  fixture.notices = initialNotices;
});
it('opens full detail, displays every priority, marks read and closes on Escape', () => {
  render(<NotificationCenter />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Open Wine running low' })
  );
  expect(fixture.markRead).toHaveBeenCalledWith('a');
  const detail = screen.getByRole('complementary', {
    name: 'Notification details',
  });
  expect(within(detail).getByText('normal')).toBeTruthy();
  expect(within(detail).getByText('5 units')).toBeTruthy();
  expect(within(detail).queryByRole('link')).toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(
    screen.queryByRole('complementary', { name: 'Notification details' })
  ).toBeNull();
});
it('filters locally, collapses groups, and submits selected unread IDs', () => {
  render(<NotificationCenter />);
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select Wine running low' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mark selected (1)' }));
  expect(fixture.markManyRead).toHaveBeenCalledWith(['a']);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Search notifications' }),
    { target: { value: 'no match' } }
  );
  expect(
    screen.queryByRole('button', { name: 'Open Wine running low' })
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(
    screen.getByRole('button', { name: 'Open Wine running low' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /1 unread/ }));
  expect(
    screen.queryByRole('button', { name: 'Open Wine running low' })
  ).toBeNull();
});
it('presents sign-in guidance separately from recoverable errors', () => {
  fixture.error = 'Sign in to view notifications.';
  render(<NotificationCenter />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText(fixture.error)).toBeTruthy();
});
it('selects filtered unread notices in one action and clears the selection', () => {
  render(<NotificationCenter />);
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select unread notices' })
  );
  expect(
    screen
      .getByRole('checkbox', { name: 'Select Wine running low' })
      .getAttribute('aria-checked')
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Mark selected (1)' }));
  expect(fixture.markManyRead).toHaveBeenCalledWith(['a']);
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(
    screen.queryByRole('button', { name: 'Mark selected (1)' })
  ).toBeNull();
});
it('moves category focus and selection using arrow keys', () => {
  render(<NotificationCenter />);
  const all = screen.getByRole('tab', { name: /^All/ });
  all.focus();
  fireEvent.keyDown(all, { key: 'ArrowRight' });
  const stock = screen.getByRole('tab', { name: /^Stock/ });
  expect(document.activeElement).toBe(stock);
  expect(stock.getAttribute('aria-selected')).toBe('true');
});
it('distinguishes filtered results and failed loads from a cleared inbox', () => {
  const { unmount } = render(<NotificationCenter />);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Search notifications' }),
    { target: { value: 'no match' } }
  );
  expect(screen.getByText('No matching notifications')).toBeTruthy();
  expect(screen.queryByText('You’re all caught up')).toBeNull();
  unmount();
  fixture.error = 'Offline';
  const saved = fixture.notices;
  fixture.notices = [];
  render(<NotificationCenter />);
  expect(screen.getByText('Notifications unavailable')).toBeTruthy();
  expect(screen.queryByText('You’re all caught up')).toBeNull();
  fixture.notices = saved;
});
it('keeps keyboard focus inside the mobile detail panel', () => {
  const width = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 375,
  });
  try {
    render(<NotificationCenter />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Wine running low' })
    );
    const dialog = screen.getByRole('dialog', { name: 'Notification details' });
    const close = within(dialog).getByRole('button', {
      name: 'Close notification details',
    });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
  } finally {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    });
  }
});

it('selects only unread records and marks only those matching the current view', () => {
  fixture.notices = [
    initialNotices[0],
    { ...initialNotices[0], _id: 'b', title: 'Read update', isRead: true },
    {
      ...initialNotices[0],
      _id: 'c',
      title: 'Strong sales',
      type: 'product_performance',
    },
  ];
  render(<NotificationCenter />);
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select Wine running low' })
  );
  expect(
    screen
      .getByRole('checkbox', { name: 'Select unread notices' })
      .getAttribute('aria-checked')
  ).toBe('mixed');
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select unread notices' })
  );
  expect(
    screen
      .getByRole('checkbox', { name: 'Select Read update' })
      .getAttribute('aria-checked')
  ).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Mark selected (2)' }));
  expect(fixture.markManyRead).toHaveBeenCalledWith(['a', 'c']);
  fireEvent.click(screen.getByRole('tab', { name: /Selling well/ }));
  expect(
    screen.queryByRole('button', { name: 'Mark selected (2)' })
  ).toBeNull();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select unread notices' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mark selected (1)' }));
  expect(fixture.markManyRead).toHaveBeenLastCalledWith(['c']);
});
it('summary cards apply inbox filters and clear restores default ordering', () => {
  render(<NotificationCenter />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter: Actionable' }));
  expect(
    screen.queryByRole('button', { name: 'Open Wine running low' })
  ).toBeNull();
  expect(
    screen
      .getByRole('button', { name: 'Filter: Actionable' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Order notifications' }),
    { target: { value: 'urgency' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(
    (
      screen.getByRole('combobox', {
        name: 'Order notifications',
      }) as HTMLSelectElement
    ).value
  ).toBe('date');
  expect(
    screen.getByRole('button', { name: 'Open Wine running low' })
  ).toBeTruthy();
});

it('keeps unread details open after reading and closes them on a filter change', () => {
  const { rerender } = render(<NotificationCenter />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter: Unread' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Open Wine running low' })
  );
  fixture.notices = [{ ...initialNotices[0], isRead: true }];
  rerender(<NotificationCenter />);
  expect(
    screen.getByRole('complementary', { name: 'Notification details' })
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Open Wine running low' })
  ).toBeNull();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Search notifications' }),
    { target: { value: 'other' } }
  );
  expect(
    screen.queryByRole('complementary', { name: 'Notification details' })
  ).toBeNull();
});
it('reports actual load coverage for a partial inbox, rather than claiming 500 rows', () => {
  fixture.total = 700;
  render(<NotificationCenter />);
  expect(screen.getByText(/Showing 1 of 700/)).toBeTruthy();
  expect(screen.queryByText(/Showing the 500 most recent/)).toBeNull();
});
it('reports partial loading even below the bounded cap', () => {
  fixture.total = 60;
  fixture.error = 'Offline';
  render(<NotificationCenter />);
  expect(screen.getByText(/Showing 1 of 60/)).toBeTruthy();
});
