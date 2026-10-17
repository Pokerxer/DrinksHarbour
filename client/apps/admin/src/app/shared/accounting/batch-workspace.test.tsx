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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { arApService, type BatchPayment } from '@/services/arAp.service';
import View from './batch-payments-view';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'token' } },
    status: 'authenticated',
  }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
const batch: BatchPayment = {
  _id: 'batch',
  number: 'BATCH-1',
  direction: 'customer',
  account: '2200',
  date: '2026-10-14',
  total: 50,
  status: 'open',
  historyAvailable: true,
  members: [
    {
      key: 'source:journal:2200',
      origin: 'pos',
      account: '2200',
      journalId: 'journal',
      number: 'RCP-1',
      name: 'Ada',
      method: 'wallet',
      date: '2026-10-14',
      capturedAmount: 60,
      refundedAmount: 10,
      amount: 50,
      sourceHref: '/ecommerce/orders/pos',
      invoice: {
        id: 'invoice',
        label: 'INV-1',
        href: '/accounting/invoices/invoice',
      },
    },
  ],
};
const result = () => ({
  success: true,
  data: [batch],
  pagination: { page: 1, pages: 2, total: 26, limit: 25 },
  batchSummary: {
    openCount: 26,
    openAmount: 1300,
    completedCount: 0,
    completedAmount: 0,
    cancelledCount: 0,
    cancelledAmount: 0,
  },
});
beforeEach(() => {
  vi.spyOn(arApService, 'batches').mockResolvedValue(result());
  vi.spyOn(arApService, 'depositBatch').mockResolvedValue({
    success: true,
    data: { ...batch, status: 'deposited' },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows complete filtered totals, named wallet account and pagination', async () => {
  render(<View />);
  await screen.findByText('BATCH-1');
  expect(screen.getByText(/1,300\.00/)).toBeTruthy();
  expect(screen.getAllByText(/Wallet/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() =>
    expect(arApService.batches).toHaveBeenLastCalledWith(
      'token',
      expect.objectContaining({ page: 2 })
    )
  );
});
it('completion is reviewed with original source details before mutation', async () => {
  render(<View />);
  await screen.findByText('BATCH-1');
  fireEvent.click(screen.getByRole('button', { name: 'Review completion' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Review batch completion',
  });
  expect(arApService.depositBatch).not.toHaveBeenCalled();
  expect(within(dialog).getByText(/wallet balances/i)).toBeTruthy();
  const confirm = within(dialog).getByRole('button', { name: 'Confirm completion' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(arApService.depositBatch).toHaveBeenCalledTimes(1)
  );
});
it('failed refresh removes stale batches and offers a read retry', async () => {
  render(<View />);
  await screen.findByText('BATCH-1');
  vi.mocked(arApService.batches).mockRejectedValueOnce(
    new Error('Connection closed')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh batches' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('BATCH-1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry batches' }));
  await screen.findByText('BATCH-1');
});
it('ignores a late customer batch response after switching to vendor batches', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  vi.mocked(arApService.batches)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue({ ...result(), data: [] });
  render(<View />);
  fireEvent.click(screen.getByRole('button', { name: 'Vendor payments' }));
  await waitFor(() => expect(arApService.batches).toHaveBeenCalledTimes(2));
  await act(async () => resolve(result()));
  expect(screen.queryByText('BATCH-1')).toBeNull();
});
it('member details link to the source invoice and retain captured/refund amounts', async () => {
  render(<View />);
  await screen.findByText('BATCH-1');
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  const dialog = screen.getByRole('dialog', { name: 'Batch details' });
  expect(
    within(dialog).getByRole('link', { name: 'INV-1' }).getAttribute('href')
  ).toBe('/accounting/invoices/invoice');
  expect(
    within(dialog).getByText(/Captured.*60\.00.*Verified refunds.*10\.00/)
  ).toBeTruthy();
});
it('unknown cancelled legacy membership is unavailable rather than zero members', async () => {
  vi.mocked(arApService.batches).mockResolvedValue({
    ...result(),
    data: [
      {
        ...batch,
        status: 'cancelled',
        members: undefined,
        historyAvailable: false,
      },
    ],
  });
  render(<View />);
  await screen.findByText('BATCH-1');
  expect(screen.queryByText(/0 members/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(screen.getByText(/Member history is unavailable/)).toBeTruthy();
});
