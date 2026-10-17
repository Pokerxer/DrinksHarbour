// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NotificationCenter from './notification-center';
import * as service from '@/services/notification.service';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { id: 'u', tenantId: 't', token: 'token' } },
  }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('reads a second opened notice while the first read is pending', async () => {
  const notices = ['First alert', 'Second alert'].map((title, i) => ({
    _id: String(i),
    title,
    message: 'Stock warning',
    type: 'low_stock_alert',
    priority: 'normal',
    isRead: false,
    createdAt: '2026-10-11T10:00:00Z',
    metadata: {},
  }));
  let finish!: (value: unknown) => void;
  vi.spyOn(service, 'notificationRequest')
    .mockResolvedValueOnce({
      notifications: notices,
      total: 2,
      unreadCount: 2,
      page: 1,
      limit: 50,
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce({ ...notices[1], isRead: true });
  render(<NotificationCenter />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Open First alert' })
    ).toBeTruthy()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open First alert' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open Second alert' }));
  const details = screen.getByRole('complementary', {
    name: 'Notification details',
  });
  await waitFor(() => expect(within(details).getByText('Read')).toBeTruthy());
  await act(async () => finish({ ...notices[0], isRead: true }));
});
