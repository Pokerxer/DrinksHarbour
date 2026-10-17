// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesOverview from './sales-overview';
import { salesOrderService, type SalesOrderListResponse } from '@/services/salesOrder.service';
import { useSalesOverview } from './use-sales-overview';
const auth = vi.hoisted(() => ({ token: '', status: 'authenticated' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: auth.token ? { user: { token: auth.token } } : null,
    status: auth.status,
  }),
}));
vi.mock('@/services/salesOrder.service', () => ({
  salesOrderService: { list: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  auth.token = '';
  auth.status = 'authenticated';
});

it('ends loading when there is no authenticated session', async () => {
  auth.status = 'unauthenticated';
  render(<SalesOverview />);
  expect(await screen.findByText(/sign in/i)).toBeTruthy();
  expect(salesOrderService.list).not.toHaveBeenCalled();
});

it('scopes monetary requests to NGN and active orders, and warns for capped monthly totals', async () => {
  auth.token = 'token';
  vi.mocked(salesOrderService.list).mockImplementation(
    async (_token, params) => ({
      success: true,
      data: [],
      groups:
        params?.groupBy === 'paymentStatus'
          ? [
              {
                _id: 'Partial',
                count: 1,
                total: 300,
                outstanding: 75.25,
                currency: 'NGN',
                docs: [],
              },
            ]
          : [],
      truncated: !!params?.dateFrom,
    })
  );
  render(<SalesOverview />);
  await waitFor(() => expect(screen.getByText(/75.25/)).toBeTruthy());
  expect(screen.getByText(/most recent documents only/i)).toBeTruthy();
  const params = vi
    .mocked(salesOrderService.list)
    .mock.calls.map((call) => call[1]);
  expect(
    params.filter((p) => p?.groupBy).every((p) => p?.currency === 'NGN')
  ).toBe(true);
  const payment = params.find((p) => p?.groupBy === 'paymentStatus');
  expect(JSON.parse(payment?.filters || '[]')).toEqual([
    {
      field: 'orderStatus',
      operator: 'in',
      value: ['confirmed', 'partially_fulfilled', 'fulfilled'],
    },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(salesOrderService.list).toHaveBeenCalledTimes(12));
});

it('does not replace a new session overview with an older pending response', async () => {
  let resolveOld!: (response: SalesOrderListResponse) => void;
  const old = new Promise<SalesOrderListResponse>((resolve) => {
    resolveOld = resolve;
  });
  const response = (total: number): SalesOrderListResponse => ({
    success: true,
    data: [],
    groups: [{ _id: 'Confirmed', count: 1, total, currency: 'NGN', docs: [] }],
  });
  vi.mocked(salesOrderService.list).mockImplementation(async (token) =>
    token === 'old' ? old : response(200)
  );
  const { result, rerender } = renderHook(
    ({ token }) => useSalesOverview(token),
    {
      initialProps: { token: 'old' },
    }
  );
  rerender({ token: 'new' });
  await waitFor(() =>
    expect(result.current.data?.monthTallies.confirmed.total).toBe(200)
  );
  await act(async () => {
    resolveOld(response(100));
  });
  expect(result.current.data?.monthTallies.confirmed.total).toBe(200);
});
