import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import OrderTrackingPage from '@/app/order-tracking/page';

const { fetcher, auth, params } = vi.hoisted(() => ({
  fetcher: vi.fn(),
  auth: { token: 'session-a' as string | null, user: { _id: 'customer-a' } as { _id: string } | null },
  params: new URLSearchParams(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));
vi.mock('@/lib/fetchWithAuth', () => ({ fetchWithAuth: fetcher }));
vi.mock('next/image', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  fetcher.mockReset();
  params.delete('orderId');
  auth.token = 'session-a';
  auth.user = { _id: 'customer-a' };
});

it('connects the order number label and announces lookup failures', async () => {
  fetcher.mockRejectedValue(new Error('Connection failed. Try again.'));
  render(<OrderTrackingPage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Order number' }), { target: { value: 'DH123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Track Order' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Connection failed');
});

it('offers sign-in with the requested order preserved instead of an unusable lookup', () => {
  auth.token = null;
  auth.user = null;
  params.set('orderId', 'DH123');
  render(<OrderTrackingPage />);
  const signIn = screen.getByRole('link', { name: 'Sign in to track your order' });
  const target = new URL(signIn.getAttribute('href')!, 'https://drinksharbour.com');
  expect(target.pathname).toBe('/login');
  expect(target.searchParams.get('redirect')).toBe('/order-tracking?orderId=DH123');
  expect(screen.queryByRole('button', { name: 'Track Order' })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

const order = {
  _id: 'order-a', orderNumber: 'DH123', status: 'confirmed', placedAt: '2026-10-27T10:00:00Z',
  items: [], subtotal: 1000, shippingFee: 0, discountTotal: 0, totalAmount: 1000,
  shippingAddress: { fullName: 'Customer A', addressLine1: 'Abuja', city: 'Abuja', state: 'FCT', country: 'Nigeria', phone: '08000000000' },
};
it('refreshes recorded order status and clears the result on account change', async () => {
  fetcher.mockImplementation(async (url: string) => ({
    ok: true, status: 200,
    json: async () => url.includes('customer-shipments') ? { data: { orderId: 'order-a', managed: false, groups: [] } } : { data: { order } },
  }));
  const view = render(<OrderTrackingPage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Order number' }), { target: { value: 'DH123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Track Order' }));
  await screen.findByText('Order #DH123');
  fetcher.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes('customer-shipments') ? { data: { orderId: 'order-a', managed: false, groups: [] } } : { data: { order: { ...order, status: 'delivered' } } } }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh order status' }));
  await screen.findByRole('link', { name: 'Return Items' });
  auth.token = null;
  auth.user = null;
  view.rerender(<OrderTrackingPage />);
  expect(screen.queryByText('Customer A')).toBeNull();
  expect(screen.getByRole('link', { name: 'Sign in to track your order' })).toBeTruthy();
});
