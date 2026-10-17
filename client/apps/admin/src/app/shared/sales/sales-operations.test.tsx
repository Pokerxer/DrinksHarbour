// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesFulfill from './sales-fulfill';
import SalesReturns from './sales-returns';
import {
  salesOrderService,
  type SalesOrder,
  type SalesOrderListResponse,
} from '@/services/salesOrder.service';
const auth = vi.hoisted(() => ({ token: 'token', status: 'authenticated' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: auth.status,
    data: auth.token ? { user: { token: auth.token } } : null,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/services/salesOrder.service', () => ({
  salesOrderService: { list: vi.fn() },
}));
const order = (id: string, returnedQty = 0): SalesOrder =>
  ({
    _id: id,
    soNumber: `SO-${id}`,
    docType: 'order',
    orderStatus: returnedQty > 0 ? 'fulfilled' : 'confirmed',
    customerSnapshot: { name: id === 'older' ? 'Ada' : 'Grace' },
    currency: 'NGN',
    warehouseId: {
      _id: id === 'older' ? 'w1' : 'w2',
      name: id === 'older' ? 'Main' : 'Annex',
    },
    items: [
      {
        _id: 'line',
        lineType: 'product',
        name: 'Wine',
        quantity: 10,
        unitPrice: 10,
        discount: 0,
        lineTotal: 100,
        postedQty: returnedQty > 0 ? 10 : 2,
        fulfilledQty: returnedQty > 0 ? 10 : 2,
        returnedQty,
      },
    ],
    subtotal: 100,
    discountTotal: 0,
    total: 100,
    fulfillments: [],
  }) as SalesOrder;
beforeEach(() => {
  auth.token = 'token';
  auth.status = 'authenticated';
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('fulfillment includes later pages instead of silently hiding older deliveries', async () => {
  vi.mocked(salesOrderService.list).mockImplementation(async (_token, p) => ({
    success: true,
    data:
      p?.status === 'confirmed'
        ? [order(Number(p.page || 1) === 1 ? 'recent' : 'older')]
        : [],
    pagination: {
      currentPage: Number(p?.page || 1),
      totalPages: 2,
      hasNextPage: p?.status === 'confirmed' && Number(p?.page || 1) === 1,
    },
  }));
  render(<SalesFulfill />);
  expect(await screen.findByText('SO-older')).toBeTruthy();
  for (const [, params] of vi.mocked(salesOrderService.list).mock.calls) {
    expect(params?.includeReturns).toBe('1');
  }
});

it('signed-out fulfillment and returns stop loading and request sign-in', async () => {
  auth.token = '';
  auth.status = 'unauthenticated';
  const view = render(<SalesFulfill />);
  expect(await screen.findByText(/sign in/i)).toBeTruthy();
  view.unmount();
  render(<SalesReturns />);
  expect(await screen.findByText(/sign in/i)).toBeTruthy();
  expect(salesOrderService.list).not.toHaveBeenCalled();
});

it('failed returns do not masquerade as an empty returns history and can retry', async () => {
  vi.mocked(salesOrderService.list).mockRejectedValue(
    new Error('Connection unavailable')
  );
  render(<SalesReturns />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No sales returns yet')).toBeNull();
  vi.mocked(salesOrderService.list).mockResolvedValue({
    success: true,
    data: [order('older', 1)],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('SO-older')).toBeTruthy();
});

it('delivery search and warehouse filters combine and clear together', async () => {
  vi.mocked(salesOrderService.list).mockImplementation(async (_token, p) => ({
    success: true,
    data: p?.status === 'confirmed' ? [order('older'), order('recent')] : [],
  }));
  render(<SalesFulfill />);
  await screen.findByText('SO-older');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Order warehouse'), {
    target: { value: 'w2' },
  });
  expect(screen.queryByText('SO-older')).toBeNull();
  expect(screen.getByText(/no matching/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /SO-older/ })).toBeTruthy()
  );
  expect(screen.getByRole('link', { name: /SO-recent/ })).toBeTruthy();
});

it('late delivery responses cannot expose a previous session order list', async () => {
  let resolveOld!: (value: SalesOrderListResponse) => void;
  const pending = new Promise<SalesOrderListResponse>((resolve) => {
    resolveOld = resolve;
  });
  vi.mocked(salesOrderService.list).mockImplementation(async (token, params) =>
    token === 'token'
      ? pending
      : {
          success: true,
          data: params?.status === 'confirmed' ? [order('fresh')] : [],
        }
  );
  const view = render(<SalesFulfill />);
  auth.token = 'new-token';
  view.rerender(<SalesFulfill />);
  expect(await screen.findByText('SO-fresh')).toBeTruthy();
  await act(async () => {
    resolveOld({ success: true, data: [order('older')] });
  });
  expect(screen.queryByText('SO-older')).toBeNull();
  expect(screen.getByText('SO-fresh')).toBeTruthy();
});
