// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import NotificationCategoryPage from '../notification-category-page';
const request = vi.fn();
vi.mock('../use-notifications', () => ({
  useNotifications: (options: unknown) => {
    request(options);
    return {
      scope: JSON.stringify(options),
      data: {
        total: 1,
        matchingUnreadCount: 1,
        unreadCount: 1,
        notifications: [
          {
            _id: 'n',
            type: 'batch_expiry_alert',
            title: 'Batch nearing expiry',
            message: 'Batch LOT-1: Deplete it before it expires.',
            priority: 'normal',
            isRead: false,
            createdAt: '2026-10-01',
            metadata: {
              batchNumber: 'LOT-1',
              expiryDate: '2026-10-01',
              quantity: 8,
              warehouseName: 'Main',
              quarantineStatus: 'quarantined',
              scanUpdatedAt: '2026-10-12T01:00:00Z',
            },
          },
        ],
      },
      loading: false,
      error: '',
      busy: false,
      refresh: vi.fn(),
      markRead: vi.fn(),
    };
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  request.mockClear();
});
it('offers expiry status/date sorting, opens safe batch details and accepts future expiry ranges', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  render(
    <NotificationCategoryPage
      category="expiry"
      title="Expiry alerts"
      description="Review batches"
    />
  );
  expect(
    (
      screen.getByRole('combobox', {
        name: 'Sort products',
      }) as HTMLSelectElement
    ).value
  ).toBe('expiry_soonest');
  fireEvent.change(screen.getByLabelText('Expiry status'), {
    target: { value: 'expired' },
  });
  expect(request.mock.lastCall?.[0]).toMatchObject({ expiryStatus: 'expired' });
  fireEvent.click(screen.getByRole('button', { name: /View update details/ }));
  const details = screen.getByRole('complementary', {
    name: 'Notification details',
  });
  expect(within(details).getByText('LOT-1')).toBeTruthy();
  expect(within(details).getByText('Quarantined')).toBeTruthy();
  expect(within(details).queryByText(/Deplete it/)).toBeNull();
  fireEvent.click(
    within(details).getByRole('button', { name: 'Close notification details' })
  );
  fireEvent.change(screen.getByLabelText('From date'), {
    target: { value: '2026-10-12' },
  });
  fireEvent.change(screen.getByLabelText('To date'), {
    target: { value: '2026-11-12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply timeframe' }));
  expect(request.mock.lastCall?.[0]).toMatchObject({
    startDate: '2026-10-12',
    endDate: '2026-11-12',
  });
});
