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
import { arApService, type SavedInvoice } from '@/services/arAp.service';
import SavedInvoiceView from './saved-invoice-view';
import * as customerInvoicePrint from '@/utils/print/customer-invoice';
const auth = vi.hoisted(() => ({ token: 'tenant-token' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/accounting/invoices/invoice-1',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: auth.token ? { user: { token: auth.token } } : null,
    status: 'authenticated',
  }),
}));
const invoice: SavedInvoice = {
  _id: 'invoice-1',
  persisted: true,
  number: 'INV-2026-000001',
  orderNumber: 'INV-2026-000001',
  source: 'sales',
  sourceId: 'source-1',
  sourceNumber: 'SO-1',
  state: 'posted',
  currency: 'NGN',
  date: '2026-10-13',
  subtotal: 100,
  discountTotal: 0,
  taxTotal: 0,
  total: 100,
  amountPaid: 100,
  outstanding: 0,
  paymentStatus: 'paid',
  customerSnapshot: { name: 'Saved customer' },
  items: [
    {
      lineType: 'product',
      name: 'Saved wine',
      quantity: 1,
      unitPrice: 100,
      lineTotal: 100,
    },
  ],
};
beforeEach(() => {
  auth.token = 'tenant-token';
  vi.spyOn(arApService, 'invoice').mockResolvedValue({
    success: true,
    data: invoice,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('opens and prints the permanent invoice snapshot with a separate source link', async () => {
  const print = vi
    .spyOn(customerInvoicePrint, 'printCustomerInvoice')
    .mockImplementation(() => {});
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  expect(arApService.invoice).toHaveBeenCalledWith('tenant-token', 'invoice-1');
  expect(
    screen.getByRole('link', { name: 'Open Sales order' }).getAttribute('href')
  ).toBe('/sales/source-1');
  expect(screen.queryByRole('button', { name: 'Record receipt' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Print invoice' }));
  expect(print).toHaveBeenCalledOnce();
  expect(print).toHaveBeenCalledWith(invoice);
});
it('shows draft reconciliation issues and protects against receipt allocation', async () => {
  vi.mocked(arApService.invoice).mockResolvedValue({
    success: true,
    data: {
      ...invoice,
      state: 'draft',
      amountPaid: 0,
      outstanding: 100,
      reconciliationIssue: 'Source posting is missing',
    },
  });
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findByText('Source posting is missing');
  expect(screen.queryByRole('button', { name: 'Record receipt' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Edit draft / Issue' })).toBeNull();
});
it('retries a failed invoice read without showing a source record as the invoice', async () => {
  vi.mocked(arApService.invoice).mockRejectedValueOnce(
    new Error('Connection closed')
  );
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findByText('Connection closed');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findAllByText('Saved wine');
  expect(arApService.invoice).toHaveBeenCalledTimes(2);
});
it('prevents duplicate reconciliation clicks and hides the old tenant snapshot', async () => {
  let complete!: () => void;
  const reconcile = vi
    .spyOn(arApService, 'reconcileInvoice')
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve({ success: true, data: invoice });
        })
    );
  const view = render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reconciling…' })).toBeTruthy()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reconciling…' }));
  expect(reconcile).toHaveBeenCalledOnce();
  await act(async () => {
    complete();
  });
  await screen.findAllByText('Saved wine');
  auth.token = '';
  view.rerender(<SavedInvoiceView id="invoice-1" />);
  expect(screen.queryByText('Saved wine')).toBeNull();
});
it('refresh reads the invoice without writing financial reconciliation', async () => {
  const reconcile = vi.spyOn(arApService, 'reconcileInvoice');
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(arApService.invoice).toHaveBeenCalledTimes(2));
  expect(reconcile).not.toHaveBeenCalled();
});
it('exposes a printing failure and allows retry without changing the invoice', async () => {
  vi.spyOn(customerInvoicePrint, 'printCustomerInvoice').mockImplementation(
    () => {
      throw new Error('Printer unavailable');
    }
  );
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  fireEvent.click(screen.getByRole('button', { name: 'Print invoice' }));
  expect(
    screen.getByText('Printing could not start. Try Print invoice again.')
  ).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Print invoice' })
      .hasAttribute('disabled')
  ).toBe(false);
});
it('records a receipt only for a reconciled posted NGN Sales invoice', async () => {
  vi.mocked(arApService.invoice).mockResolvedValue({
    success: true,
    data: {
      ...invoice,
      outstanding: 60,
      amountPaid: 40,
      paymentStatus: 'partial',
    },
  });
  const view = render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  expect(screen.getByRole('button', { name: 'Record receipt' })).toBeTruthy();
  vi.mocked(arApService.invoice).mockResolvedValue({
    success: true,
    data: { ...invoice, _id: 'invoice-2', outstanding: 60, currency: 'USD' },
  });
  view.rerender(<SavedInvoiceView id="invoice-2" />);
  await screen.findAllByText('Saved wine');
  expect(screen.queryByRole('button', { name: 'Record receipt' })).toBeNull();
});
it('does not carry an old reconciliation failure into a different invoice', async () => {
  let fail!: (err: Error) => void;
  vi.spyOn(arApService, 'reconcileInvoice').mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      })
  );
  const view = render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }));
  vi.mocked(arApService.invoice).mockResolvedValue({
    success: true,
    data: { ...invoice, _id: 'invoice-2', number: 'INV-2', items: [] },
  });
  view.rerender(<SavedInvoiceView id="invoice-2" />);
  await screen.findByText('INV-2');
  await act(async () => {
    fail(new Error('Old invoice failed'));
  });
  expect(screen.queryByText('Old invoice failed')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Reconcile' }).hasAttribute('disabled')
  ).toBe(false);
});
it('shows payment activity with its allocation scope and omits zero adjustments', async () => {
  vi.mocked(arApService.invoice).mockResolvedValue({
    success: true,
    data: {
      ...invoice,
      detailContext: {
        issuer: {
          name: 'Wyn City',
          bankAccounts: [
            {
              bankName: 'Test Bank',
              accountNumber: '0123456789',
              accountName: 'Wyn City',
            },
          ],
        },
        activity: [
          {
            id: 'payment-1',
            kind: 'receipt',
            label: 'PAY-1',
            date: '2026-10-13',
            amount: 40,
            status: 'active',
            scope: 'invoice',
            method: 'cash',
          },
        ],
      },
    } as SavedInvoice,
  });
  render(<SavedInvoiceView id="invoice-1" />);
  await screen.findAllByText('Saved wine');
  expect(screen.getByText('PAY-1')).toBeTruthy();
  expect(screen.getByText('Test Bank')).toBeTruthy();
  expect(screen.queryByText('Rounding')).toBeNull();
});
