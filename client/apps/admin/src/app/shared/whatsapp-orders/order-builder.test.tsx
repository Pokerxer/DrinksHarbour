// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import OrderBuilder from './order-builder';

vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({ user: { token: 'staff-token' } }),
}));
vi.mock('./builder-scan-drawer', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('fills a product row from tenant stock and submits a pinned delivery with a zero fee', async () => {
  const customer = {
    _id: 'customer',
    firstName: 'Ada',
    lastName: 'Okafor',
    email: 'ada@example.com',
    phone: '+2348012345678',
  };
  const product = { _id: 'product', name: 'Woodford Reserve' };
  const variant = {
    sizeId: 'size',
    displayName: '70cl',
    availableStock: 103,
    marketplacePrice: 28500,
  };
  let available = false;
  sessionStorage.setItem(
    'dh:wa-builder-draft-v2',
    JSON.stringify({
      customer,
      lines: [],
      delivery: {
        address: 'Customer street',
        state: 'Lagos',
        lga: 'Ikeja',
        zipCode: '',
        country: 'Nigeria',
        pin: { lat: 6.6, lon: 3.4 },
      },
    })
  );

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    const { pathname } = new URL(url);
    const json = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }));
    if (pathname === '/api/whatsapp-orders/customers/customer')
      return json({ customer, addresses: [] });
    if (pathname === '/api/subproducts')
      return json({
        subProducts: [{ _id: 'listing', product }],
        pagination: { total: 1 },
      });
    if (pathname === '/api/whatsapp-orders/catalogue/offers')
      return json({
        offers: [
          {
            productId: product._id,
            subProductId: 'listing',
            tenantId: 'tenant',
            tenantName: 'Wyn City',
            sizes: [variant],
          },
        ],
      });
    if (pathname === '/api/shipping/lgas') return json(['Ikeja']);
    if (pathname === '/api/shipping/calculate')
      return json({ baseFee: 4300, source: 'google', distanceKm: 14 });
    if (pathname === '/api/cart/validate') {
      const {
        items: [line],
      } = JSON.parse(String(options?.body)) as {
        items: Array<{ quantity: number }>;
      };
      const status = !available
        ? 'out_of_stock'
        : line.quantity > 1
          ? 'quantity_reduced'
          : 'ok';
      return json({
        items: [
          {
            subProductId: 'listing',
            sizeId: 'size',
            status,
            currentPrice: available ? 29000 : 28500,
            maxQuantity: available ? 1 : 0,
          },
        ],
      });
    }
    if (pathname === '/api/orders' && options?.method === 'POST')
      return json({
        order: { _id: 'order', orderNumber: 'DH-TEST', totalAmount: 29000 },
      });
    throw new Error(`Unexpected request to ${pathname}`);
  });
  vi.stubGlobal('fetch', request);
  render(<OrderBuilder />);

  fireEvent.click(screen.getByRole('button', { name: 'Add a product' }));
  fireEvent.change(screen.getByPlaceholderText(/add a line note/i), {
    target: { value: 'Wrap as a gift' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Select from catalogue…' })
  );
  const card = await screen.findByRole('article', { name: product.name });
  fireEvent.click(within(card).getByRole('button', { name: 'Add to order' }));
  const tenant = await screen.findByRole('dialog', {
    name: 'Offered by 1 tenant',
  });
  fireEvent.click(within(tenant).getByRole('button', { name: 'Add' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  expect(screen.getAllByPlaceholderText(/add a line note/i)).toHaveLength(1);
  await screen.findByText(/out of stock/);
  await screen.findByText(/14 km by road/);
  fireEvent.click(screen.getByRole('button', { name: 'Edit delivery fee' }));
  fireEvent.change(
    screen.getByRole('spinbutton', { name: /manual delivery fee/i }),
    { target: { value: '0' } }
  );
  const submit = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Create order',
  });
  expect(submit.disabled).toBe(true);
  available = true;
  const row = screen.getByText(product.name).closest('tr')!;
  const quantity = within(row).getByRole<HTMLInputElement>('spinbutton');
  fireEvent.change(quantity, { target: { value: '2' } });
  await waitFor(() => expect(submit.disabled).toBe(false));
  expect(quantity.value).toBe('1');
  expect(row.textContent).toContain('29,000');
  fireEvent.click(submit);

  await screen.findByRole('heading', { name: 'Order DH-TEST created' });
  const posted = request.mock.calls.find(
    ([url]) => new URL(url).pathname === '/api/orders'
  )?.[1];
  expect(posted?.headers).toHaveProperty(
    'Idempotency-Key',
    expect.stringMatching(/^wa-/)
  );
  expect(JSON.parse(String(posted?.body))).toMatchObject({
    items: [
      { subProductId: 'listing', sizeId: 'size', quantity: 1, price: 29000 },
    ],
    shipping: { coordinates: { latitude: 6.6, longitude: 3.4 } },
    shippingFee: 0,
    total: 29000,
    manualOrder: {
      customerId: 'customer',
      deliveryFeeOverride: 0,
      printLines: [{ description: 'Wrap as a gift', productIndex: 0 }],
    },
  });
});
