// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { arApService, type PaymentDoc } from '@/services/arAp.service';
import PaymentsView from './payments-view';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
const payment: PaymentDoc = {
  _id: 'receipt',
  number: 'PAY-1',
  customerName: 'Ada',
  date: '2026-10-14',
  amount: 100,
  method: 'cash',
  status: 'active',
  allocations: [{ salesOrder: 'sales', amount: 60 }],
};
beforeEach(() => {
  vi.spyOn(arApService, 'payments').mockResolvedValue({
    success: true,
    data: [payment],
    pagination: { page: 1, pages: 1, total: 1, limit: 25 },
  });
  vi.spyOn(arApService, 'cancelPayment').mockResolvedValue({
    success: true,
    data: { ...payment, status: 'cancelled' },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows unallocated money independently of recorded amount', async () => {
  render(<PaymentsView />);
  await screen.findAllByText('PAY-1');
  expect(screen.getAllByText(/₦\s*40\.00/).length).toBeGreaterThan(0);
});
it('failed refresh removes stale payments and offers a retry', async () => {
  render(<PaymentsView />);
  await screen.findAllByText('PAY-1');
  vi.mocked(arApService.payments).mockRejectedValueOnce(
    new Error('Connection closed')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
  await screen.findByRole('alert');
  expect(screen.queryAllByText('PAY-1').length).toBe(0);
  expect(screen.queryAllByText(/₦\s*0\.00/).length).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Retry payments' }));
  await screen.findAllByText('PAY-1');
});
it('cancellation reviews the allocations instead of immediately reversing', async () => {
  render(<PaymentsView />);
  await screen.findAllByText('PAY-1');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Review cancellation' })[0]
  );
  expect(arApService.cancelPayment).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog', {
    name: 'Review receipt cancellation',
  });
  expect(within(dialog).getByText(/No money is sent/)).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Cancel and reverse' })
  );
  await waitFor(() =>
    expect(arApService.cancelPayment).toHaveBeenCalledWith(
      'token',
      'customer',
      'receipt'
    )
  );
});
it('batch payments explain why individual cancellation is unavailable', async () => {
  vi.mocked(arApService.payments).mockResolvedValue({
    success: true,
    data: [{ ...payment, batch: 'batch' }],
  });
  render(<PaymentsView />);
  await screen.findAllByText('PAY-1');
  expect(screen.getAllByText('Managed in batch').length).toBeGreaterThan(0);
  expect(
    screen.queryByRole('button', { name: 'Review cancellation' })
  ).toBeNull();
});
it('Sales/POS source receipts link to invoices and cannot be cancelled as Accounting records', async () => {
  vi.mocked(arApService.payments).mockResolvedValue({
    success: true,
    data: [
      {
        ...payment,
        _id: 'source:journal',
        source: 'pos',
        readOnly: true,
        sourceHref: '/ecommerce/orders/pos',
        refundedAmount: 20,
        allocations: [],
        invoice: {
          id: 'invoice',
          label: 'INV-1',
          href: '/accounting/invoices/invoice',
        },
      },
    ],
  } as Awaited<ReturnType<typeof arApService.payments>>);
  render(<PaymentsView />);
  await screen.findAllByText('PAY-1');
  expect(screen.getAllByText('POS').length).toBeGreaterThan(0);
  expect(
    screen.queryByRole('button', { name: 'Review cancellation' })
  ).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
  const dialog = screen.getByRole('dialog', { name: 'Receipt details' });
  expect(
    within(dialog).getByRole('link', { name: /INV-1/ }).getAttribute('href')
  ).toBe('/accounting/invoices/invoice');
  expect(within(dialog).getByText(/₦\s*20\.00/)).toBeTruthy();
});
