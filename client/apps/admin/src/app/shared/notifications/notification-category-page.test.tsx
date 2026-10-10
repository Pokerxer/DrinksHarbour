// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NotificationCategoryPage from './notification-category-page';
const read = vi.fn();
vi.mock('./use-notifications', () => ({
  useNotifications: (options: unknown) => {
    read(options);
    return {
      data: {
        total: 80,
        unreadCount: 100,
        matchingUnreadCount: 55,
        notifications: [],
      },
      loading: false,
      error: '',
      busy: false,
      refresh: vi.fn(),
      markRead: vi.fn(),
    };
  },
}));
vi.mock('./notification-list', () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  read.mockClear();
});
it('uses all matching unread notices and filters product decisions before pagination', () => {
  render(
    <NotificationCategoryPage
      category="products"
      title="Product updates"
      description="Updates"
    />
  );
  expect(
    screen.getByRole('button', { name: 'Filter: Unread notices' }).textContent
  ).toContain('55');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Product decision' }), {
    target: { value: 'product_rejected' },
  });
  expect(read.mock.lastCall?.[0]).toMatchObject({
    category: 'products',
    type: 'product_rejected',
    page: 1,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(read.mock.lastCall?.[0].type).toBeUndefined();
});
it('searches all category notices on the server and resets pagination on changed controls', async () => {
  render(
    <NotificationCategoryPage
      category="expiry"
      title="Expiry alerts"
      description="Review expiry dates"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(read.mock.lastCall?.[0].page).toBe(2);
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search notifications' }),
    { target: { value: 'wine' } }
  );
  await waitFor(() =>
    expect(read.mock.lastCall?.[0]).toEqual({
      category: 'expiry',
      page: 1,
      limit: 50,
      unreadOnly: false,
      search: 'wine',
      sort: 'newest',
    })
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort products' }), {
    target: { value: 'oldest' },
  });
  expect(read.mock.lastCall?.[0].sort).toBe('oldest');
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Unread notices' })
  );
  expect(read.mock.lastCall?.[0].unreadOnly).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(read.mock.lastCall?.[0]).toEqual({
    category: 'expiry',
    page: 1,
    limit: 50,
    unreadOnly: false,
    search: '',
    sort: 'newest',
  });
});
it('applies a custom timeframe atomically and resets the current page', () => {
  render(
    <NotificationCategoryPage
      category="products"
      title="Product updates"
      description="Updates"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('From date'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('To date'), {
    target: { value: '2026-09-30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply timeframe' }));
  expect(read.mock.lastCall?.[0]).toMatchObject({
    page: 1,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset timeframe' }));
  expect(read.mock.lastCall?.[0].startDate).toBeUndefined();
});
