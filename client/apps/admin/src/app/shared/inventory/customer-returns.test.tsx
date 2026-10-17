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
import CustomerReturns from './customer-returns';
import {
  customerReturnsService,
  type CustomerReturnPage,
} from '@/services/customerReturns.service';
const auth = vi.hoisted(() => ({ token: 'tenant-token' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: auth.token ? { user: { token: auth.token } } : null,
    status: 'authenticated',
  }),
}));
const data: CustomerReturnPage = {
  rows: [
    {
      id: 'ret',
      source: 'pos',
      sourceId: 'order',
      sourceNumber: 'RCP-1',
      reference: 'RET-1',
      product: 'Damaged wine',
      size: '750ml',
      returned: 2,
      restocked: 0,
      notRestocked: 2,
      stockEvidence: 'verified',
      date: '2026-10-10',
      warehouse: null,
      reason: 'Broken',
    },
  ],
  total: 26,
  page: 1,
  pages: 2,
  summary: {
    count: 26,
    returned: 30,
    restocked: 10,
    notRestocked: 2,
    unverified: 1,
  },
  locations: [],
  issuer: { name: 'Wyn City' },
};
beforeEach(() => {
  auth.token = 'tenant-token';
  vi.spyOn(customerReturnsService, 'list').mockResolvedValue(data);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('shows non-restocked goods, matched totals, source links and server pagination', async () => {
  render(<CustomerReturns />);
  await screen.findAllByText('Damaged wine');
  expect(screen.getByText('30')).toBeTruthy();
  expect(screen.getAllByText('Not restocked').length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole('button', { name: 'View RET-1' })[0]);
  expect(
    screen.getByRole('link', { name: 'Open POS receipt' }).getAttribute('href')
  ).toContain('receipt=RCP-1');
  expect(screen.getByText('Broken')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() =>
    expect(customerReturnsService.list).toHaveBeenLastCalledWith(
      'tenant-token',
      expect.objectContaining({ page: 2 })
    )
  );
  fireEvent.change(screen.getByLabelText('Return source'), {
    target: { value: 'sales' },
  });
  await waitFor(() =>
    expect(customerReturnsService.list).toHaveBeenLastCalledWith(
      'tenant-token',
      expect.objectContaining({ page: 1, source: 'sales' })
    )
  );
});
it('shows missing evidence rather than claiming goods were restocked', async () => {
  vi.mocked(customerReturnsService.list).mockResolvedValue({
    ...data,
    rows: [
      {
        ...data.rows[0],
        restocked: null,
        notRestocked: null,
        date: null,
        stockEvidence: 'unverified',
      },
    ],
  });
  render(<CustomerReturns />);
  await screen.findAllByText('Damaged wine');
  expect(screen.getAllByText('Stock evidence missing').length).toBeGreaterThan(
    0
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'View RET-1' })[0]);
  expect(screen.getByText('Date unavailable')).toBeTruthy();
});
it('offers retry and disables printing after a failed refresh', async () => {
  render(<CustomerReturns />);
  await screen.findAllByText('Damaged wine');
  vi.mocked(customerReturnsService.list).mockRejectedValueOnce(
    new Error('History unavailable')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByRole('alert');
  expect(screen.queryAllByText('Damaged wine')).toHaveLength(0);
  expect(
    screen
      .getByRole('button', { name: 'Print this page' })
      .hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findAllByText('Damaged wine');
});
it('ignores late responses from another business session', async () => {
  let resolveOld!: (value: CustomerReturnPage) => void;
  vi.mocked(customerReturnsService.list).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    })
  );
  const view = render(<CustomerReturns />);
  auth.token = 'another-business';
  vi.mocked(customerReturnsService.list).mockResolvedValue({
    ...data,
    rows: [],
  });
  view.rerender(<CustomerReturns />);
  await waitFor(() =>
    expect(customerReturnsService.list).toHaveBeenCalledWith(
      'another-business',
      expect.anything()
    )
  );
  resolveOld(data);
  await waitFor(() =>
    expect(screen.queryAllByText('Damaged wine')).toHaveLength(0)
  );
});
it('keeps invoice-linked returns scoped from the first history request', async () => {
  render(<CustomerReturns invoiceId="invoice-1" />);
  await screen.findAllByText('Damaged wine');
  expect(customerReturnsService.list).toHaveBeenCalledWith(
    'tenant-token',
    expect.objectContaining({ invoice: 'invoice-1' })
  );
  expect(
    vi
      .mocked(customerReturnsService.list)
      .mock.calls.every(([, filters]) => filters.invoice === 'invoice-1')
  ).toBe(true);
});

it('initial empty search does not close a return detail after the debounce interval', async()=>{
  vi.useFakeTimers();
  await act(async()=>{render(<CustomerReturns/>);});
  fireEvent.click(screen.getAllByRole('button',{name:'View RET-1'})[0]);
  expect(screen.getByRole('link',{name:'Open POS receipt'})).toBeTruthy();
  await act(async()=>{await vi.advanceTimersByTimeAsync(350);});
  expect(screen.getByRole('link',{name:'Open POS receipt'})).toBeTruthy();
});
