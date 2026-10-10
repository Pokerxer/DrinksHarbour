// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductUpdatesList from './product-updates-list';
import type { TenantNotice } from '@/services/notification.service';
afterEach(cleanup);
const notice: TenantNotice = {
  _id: 'a',
  type: 'product_rejected',
  title: 'Product Rejected',
  message: 'Your wine needs changes.',
  priority: 'normal',
  isRead: false,
  createdAt: '2026-10-09T10:00:00Z',
  actionUrl: '/sub-products',
  actionLabel: 'Review listing',
  metadata: {
    productName: 'Wine',
    rejectionReason: 'Verify the bottle volume',
  },
};
const props = {
  notifications: [notice],
  loading: false,
  error: '',
  busy: false,
  onRetry: vi.fn(),
  onRead: vi.fn(),
};
it('empty product history does not imply every listing has been approved', () => {
  render(<ProductUpdatesList {...props} notifications={[]} />);
  expect(screen.getByText('No product updates')).toBeTruthy();
  expect(
    screen.getByText(/Approval decisions matching your filters/)
  ).toBeTruthy();
});
it('opens rejection facts and safe next action without marking read just for opening', () => {
  const onRead = vi.fn();
  render(<ProductUpdatesList {...props} onRead={onRead} />);
  fireEvent.click(screen.getByRole('button', { name: 'View update details' }));
  const panel = screen.getByLabelText('Notification details');
  expect(within(panel).getByText('Verify the bottle volume')).toBeTruthy();
  expect(
    within(panel)
      .getByRole('link', { name: 'Review listing' })
      .getAttribute('href')
  ).toBe('/sub-products');
  expect(onRead).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  expect(onRead).toHaveBeenCalledWith('a');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByLabelText('Notification details')).toBeNull();
});
it('refreshes selected evidence, blocks unsafe links and clears removed updates', () => {
  const { rerender } = render(<ProductUpdatesList {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'View update details' }));
  rerender(
    <ProductUpdatesList
      {...props}
      notifications={[
        {
          ...notice,
          isRead: true,
          actionUrl: '//evil.test',
          metadata: { rejectionReason: 'Updated review reason' },
        },
      ]}
    />
  );
  const panel = screen.getByLabelText('Notification details');
  expect(within(panel).getByText('Updated review reason')).toBeTruthy();
  expect(within(panel).queryByRole('link')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
  rerender(<ProductUpdatesList {...props} notifications={[]} />);
  expect(screen.queryByLabelText('Notification details')).toBeNull();
  rerender(<ProductUpdatesList {...props} />);
  expect(screen.queryByLabelText('Notification details')).toBeNull();
});
