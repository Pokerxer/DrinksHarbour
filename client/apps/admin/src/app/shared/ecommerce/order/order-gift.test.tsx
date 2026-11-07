// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OrderView from './order-view';
import OrderTableRow from './order-list/order-table-row';
import type { Order } from '@/services/order.service';
import type { OrderGift } from './order-view/gift';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { role: 'admin', token: 'staff-token' } } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => { cleanup(); });

const gift: OrderGift = {
  isGift: true,
  from: 'Ada Obi',
  to: 'Ngozi Bello',
  message: 'Happy birthday! Enjoy responsibly.',
  requestedDeliveryDate: '2026-12-05',
  packagingRequested: true,
};

const baseOrder = {
  _id: '507f1f77bcf86cd799439011',
  orderNumber: 'DH-100200',
  user: null,
  items: [
    {
      product: { _id: 'p1', name: 'Hibiki 12' },
      quantity: 1,
      priceAtPurchase: 50000,
      itemSubtotal: 50000,
    },
  ],
  subtotal: 50000,
  discountTotal: 0,
  shippingFee: 0,
  taxAmount: 0,
  totalAmount: 50000,
  currency: 'NGN',
  paymentMethod: 'card',
  paymentStatus: 'paid',
  status: 'processing',
  placedAt: '2026-10-20T09:30:00Z',
  createdAt: '2026-10-20T09:30:00Z',
  updatedAt: '2026-10-20T09:30:00Z',
} as Order;

const giftOrder: Order = { ...baseOrder, gift } as Order & { gift?: OrderGift };
const plainOrder: Order = baseOrder;

test('gift order detail renders the read-only Gift panel with from/to/message/date/packaging', async () => {
  render(<OrderView orderId={giftOrder._id} initialOrder={giftOrder} />);
  await screen.findByText('Gift');
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  expect(screen.getByText('Ngozi Bello')).toBeTruthy();
  expect(screen.getByText('Happy birthday! Enjoy responsibly.')).toBeTruthy();
  // Requested date is formatted en-NG and never presented as guaranteed.
  const requested = screen.getByText(/5 December 2026/);
  expect(requested.textContent).toContain(
    'requested — confirm the exact window with the recipient/customer'
  );
  expect(
    screen.getByText('Requested — confirm box/hamper in writing')
  ).toBeTruthy();
});

test('non-gift order detail renders no Gift panel', async () => {
  render(<OrderView orderId={plainOrder._id} initialOrder={plainOrder} />);
  await screen.findByText('Customer Details');
  expect(screen.queryByText('Requested — confirm box/hamper in writing')).toBeNull();
  expect(screen.queryByText(/5 December 2026/)).toBeNull();
});

test('gift order row shows an amber Gift badge and requested date; plain row shows neither', () => {
  const onView = vi.fn();
  const { container } = render(
    <table>
      <tbody>
        <OrderTableRow order={giftOrder} index={0} onView={onView} />
        <OrderTableRow order={plainOrder} index={1} onView={onView} />
      </tbody>
    </table>
  );
  const badge = screen.getByText('Gift');
  expect(badge.className).toContain('amber');
  // Requested delivery date appears in the list (short format), gift row only.
  expect(screen.getByText(/Req\. 5 Dec 2026/)).toBeTruthy();
  const rows = container.querySelectorAll('tbody tr');
  expect(rows[1].textContent).not.toContain('Gift');
  expect(rows[1].textContent).not.toContain('Req.');
});

test('gift message renders as plain text, never injected HTML', () => {
  const hostile: Order = {
    ...baseOrder,
    gift: { ...gift, message: '<img src=x onerror=alert(1)>' },
  } as Order & { gift?: OrderGift };
  render(<OrderView orderId={hostile._id} initialOrder={hostile} />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
});

test('date helpers: en-NG formatting from YYYY-MM-DD without timezone drift', async () => {
  const { formatRequestedDeliveryDate } = await import('./order-view/gift');
  expect(formatRequestedDeliveryDate('2026-12-05')).toBe('5 December 2026');
  expect(formatRequestedDeliveryDate('2026-12-05', { short: true })).toBe('5 Dec 2026');
  expect(formatRequestedDeliveryDate('')).toBe('—');
  expect(formatRequestedDeliveryDate('not-a-date')).toBe('—');
  const { getGift } = await import('./order-view/gift');
  expect(getGift(plainOrder)).toBeNull();
  expect(getGift(giftOrder)?.from).toBe('Ada Obi');
});
