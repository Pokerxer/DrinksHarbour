// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ArApDocsView from './ar-ap-docs-view';
import AccountingDocumentResults from './accounting-document-results';
import { arApService, type OpenInvoice } from '@/services/arAp.service';

const auth = vi.hoisted(() => ({
  token: 'tenant-token',
  status: 'authenticated',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: auth.token ? { user: { token: auth.token } } : null,
    status: auth.status,
  }),
}));
const invoice: OpenInvoice = {
  _id: 'invoice-1',
  orderNumber: 'INV-1',
  date: '2026-09-01',
  dueDate: '2026-09-02',
  total: 100,
  amountPaid: 20,
  creditedAmount: 5,
  outstanding: 75,
  paymentStatus: 'partial',
  customerSnapshot: { name: 'Ada' },
};
const response = (
  docs: OpenInvoice[] = [],
  total = docs.length,
  pages = 1
) => ({
  success: true,
  data: docs,
  pagination: { page: 1, limit: 25, total, pages },
});

beforeEach(() => {
  auth.token = 'tenant-token';
  auth.status = 'authenticated';
  vi.spyOn(arApService, 'receivablesSummary').mockResolvedValue({
    success: true,
    data: {
      count: 1,
      totalOutstanding: 125,
      onAccount: 50,
      buckets: { current: 125 },
    },
  });
  vi.spyOn(arApService, 'invoices').mockResolvedValue(response([invoice]));
});

it('paid POS receipts have source-aware links, no overdue label and disabled receipt allocation', async () => {
  vi.mocked(arApService.invoices).mockResolvedValue(
    response([
      {
        ...invoice,
        source: 'pos',
        paymentStatus: 'paid',
        amountPaid: 100,
        creditedAmount: 0,
        outstanding: 0,
      },
    ])
  );
  render(<ArApDocsView side="customer" />);
  await screen.findAllByText('INV-1');
  expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  expect(screen.queryByText(/^\d+ days overdue$/)).toBeNull();
  expect(
    screen
      .getAllByRole('button', { name: 'Record receipt' })
      .every((button) => (button as HTMLButtonElement).disabled)
  ).toBe(true);
  expect(
    screen.getAllByRole('link', { name: 'INV-1' })[0].getAttribute('href')
  ).toBe('/ecommerce/orders/invoice-1');
  fireEvent.click(screen.getByRole('button', { name: 'Paid' }));
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenCalledWith(
      'tenant-token',
      expect.objectContaining({ status: 'paid' })
    )
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('invoice workspace', () => {
  it('does not leave a signed-out user waiting for invoices', () => {
    auth.token = '';
    auth.status = 'unauthenticated';
    render(<ArApDocsView side="customer" />);
    expect(screen.getByText(/sign in to view/i)).toBeTruthy();
    expect(arApService.invoices).not.toHaveBeenCalled();
  });
  it('explains customer accounts separately from invoice debt', async () => {
    render(<ArApDocsView side="customer" />);
    expect(await screen.findByText('Invoice balance')).toBeTruthy();
    expect(screen.getByText('Customer accounts')).toBeTruthy();
    expect(screen.getAllByText('₦ 75.00').length).toBeGreaterThan(0);
    expect(screen.getByText('₦ 50.00')).toBeTruthy();
  });
  it('shows readable partial and overdue labels and retains receipt context', () => {
    const pay = vi.fn();
    render(
      <AccountingDocumentResults
        docs={[invoice]}
        side="customer"
        loading={false}
        onPay={pay}
      />
    );
    expect(screen.getAllByText('Partially paid').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/days overdue/).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Record receipt' })[0]
    );
    expect(pay).toHaveBeenCalledWith(invoice);
  });
  it('returns to the last available page when invoices disappear', async () => {
    vi.mocked(arApService.invoices)
      .mockResolvedValueOnce(response([invoice], 26, 2))
      .mockResolvedValueOnce(response([], 25, 1))
      .mockResolvedValueOnce(response([invoice], 25, 1));
    render(<ArApDocsView side="customer" />);
    await screen.findByText('Page 1 of 2');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(arApService.invoices).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('Page 1 of 1')).toBeTruthy();
    expect(vi.mocked(arApService.invoices).mock.calls[2][1]?.page).toBe(1);
  });
  it('ignores a late response from the previous status filter', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    vi.mocked(arApService.invoices)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(
        response([{ ...invoice, orderNumber: 'INV-NEW' }])
      );
    render(<ArApDocsView side="customer" />);
    fireEvent.click(screen.getByRole('button', { name: 'Unpaid' }));
    await screen.findAllByText(/INV-NEW/);
    await act(async () =>
      resolveOld(response([{ ...invoice, orderNumber: 'INV-OLD' }]))
    );
    await waitFor(() => expect(screen.queryByText(/INV-OLD/)).toBeNull());
  });
  it('retries balances independently of the invoice list', async () => {
    vi.mocked(arApService.receivablesSummary).mockRejectedValueOnce(
      new Error('Database temporarily unavailable')
    );
    render(<ArApDocsView side="customer" />);
    const retry = await screen.findByRole('button', { name: 'Retry balances' });
    await screen.findAllByText('INV-1');
    fireEvent.click(retry);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Retry balances' })
      ).toBeNull()
    );
    expect(arApService.invoices).toHaveBeenCalledTimes(1);
    expect(arApService.receivablesSummary).toHaveBeenCalledTimes(2);
  });
  it('keeps previous invoices visible on a failed refresh but prevents stale receipts and exports', async () => {
    vi.mocked(arApService.invoices)
      .mockResolvedValueOnce(response([invoice]))
      .mockRejectedValueOnce(new Error('Database unavailable'));
    render(<ArApDocsView side="customer" />);
    await screen.findAllByText('INV-1');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Refresh' }).hasAttribute('disabled')
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText(/Previous results are shown/);
    expect(screen.getAllByText('INV-1').length).toBeGreaterThan(0);
    expect(
      screen
        .getByRole('button', { name: 'Export page' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('button', { name: 'Record receipt' })
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true);
  });
});
it('invalid issue dates block stale receipts and exports until the filters are corrected', async () => {
  render(<ArApDocsView side="customer" />);
  await screen.findAllByText('INV-1');
  fireEvent.change(screen.getByLabelText('Issued from'), {
    target: { value: '2026-10-20' },
  });
  const calls = vi.mocked(arApService.invoices).mock.calls.length;
  fireEvent.change(screen.getByLabelText('Issued to'), {
    target: { value: '2026-10-10' },
  });
  await screen.findByText(/start date must be on or before/);
  expect(arApService.invoices).toHaveBeenCalledTimes(calls);
  expect(
    screen.getByRole('button', { name: 'Export page' }).hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen
      .getAllByRole('button', { name: 'Record receipt' })
      .every((button) => button.hasAttribute('disabled'))
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Export page' })
        .hasAttribute('disabled')
    ).toBe(false)
  );
});
it('return status and issue dates reach the invoice query together and clear together', async () => {
  render(<ArApDocsView side="customer" />);
  await screen.findAllByText('INV-1');
  fireEvent.change(screen.getByLabelText('Return status'), {
    target: { value: 'full' },
  });
  fireEvent.change(screen.getByLabelText('Issued from'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Issued to'), {
    target: { value: '2026-09-30' },
  });
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenLastCalledWith(
      'tenant-token',
      expect.objectContaining({
        returnStatus: 'full',
        from: '2026-09-01',
        to: '2026-09-30',
        page: 1,
      })
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenLastCalledWith(
      'tenant-token',
      expect.objectContaining({
        returnStatus: undefined,
        from: undefined,
        to: undefined,
        page: 1,
      })
    )
  );
});
it('reviewing the header draft balances opens the draft ledger', async () => {
  vi.mocked(arApService.receivablesSummary).mockResolvedValue({
    success: true,
    data: {
      count: 0,
      totalOutstanding: 0,
      onAccount: 0,
      buckets: { current: 0 },
      reviewCount: 6,
      reviewBalanceCount: 3,
      reviewOutstanding: 3927715.68,
    },
  });
  render(<ArApDocsView side="customer" />);
  expect(await screen.findByText('₦ 3,927,715.68')).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review draft invoices' })
  );
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenLastCalledWith(
      'tenant-token',
      expect.objectContaining({ status: 'draft', page: 1, search: undefined })
    )
  );
});
