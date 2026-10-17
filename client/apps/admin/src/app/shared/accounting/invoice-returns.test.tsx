// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { arApService, type SavedInvoice } from '@/services/arAp.service';
import ArApDocsView from './ar-ap-docs-view';
import SavedInvoiceView from './saved-invoice-view';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'token' } },
    status: 'authenticated',
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/accounting/invoices/invoice',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
const invoice = {
  _id: 'invoice',
  persisted: true,
  number: 'INV-1',
  orderNumber: 'INV-1',
  source: 'sales',
  sourceId: 'sales',
  sourceNumber: 'SO-1',
  state: 'posted',
  date: '2026-10-14',
  currency: 'NGN',
  customerSnapshot: { name: 'Ada' },
  items: [
    {
      lineType: 'product',
      name: 'Wine',
      quantity: 10,
      unitPrice: 10,
      lineTotal: 100,
    },
  ],
  subtotal: 100,
  taxTotal: 0,
  discountTotal: 0,
  total: 100,
  amountPaid: 100,
  creditedAmount: 0,
  outstanding: 0,
  paymentStatus: 'paid',
  returnSummary: {
    status: 'partial',
    soldUnits: 10,
    returnedUnits: 3,
    recordedUnits: 3,
    refundRecorded: false,
    needsReview: false,
    truncated: false,
    lines: [
      {
        source: 'sales',
        sourceId: 'sales',
        sourceNumber: 'SO-1',
        reference: 'SO-1',
        product: 'Wine',
        returned: 3,
      },
    ],
  },
} as SavedInvoice;
beforeEach(() => {
  vi.spyOn(arApService, 'receivablesSummary').mockResolvedValue({
    success: true,
    data: { count: 0, totalOutstanding: 0, buckets: { current: 0 } },
  });
  vi.spyOn(arApService, 'invoices').mockResolvedValue({
    success: true,
    data: [invoice],
    pagination: { page: 1, pages: 1, limit: 25, total: 1 },
  });
  vi.spyOn(arApService, 'invoice').mockResolvedValue({
    success: true,
    data: invoice,
  });
  vi.spyOn(arApService, 'customers').mockResolvedValue({
    success: true,
    data: [],
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows returned status separately and filters returns before server pagination', async () => {
  render(<ArApDocsView side="customer" />);
  await screen.findAllByText('INV-1');
  expect(screen.getAllByText('Partially returned').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Return status'), {
    target: { value: 'full' },
  });
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenLastCalledWith(
      'token',
      expect.objectContaining({ returnStatus: 'full', page: 1 })
    )
  );
});
it('opens a reviewed credit draft without auto-posting or guessing amounts', async () => {
  render(<SavedInvoiceView id="invoice" />);
  await screen.findByText('Credit review pending');
  expect(
    screen
      .getByRole('link', { name: 'Open Inventory returns' })
      .getAttribute('href')
  ).toContain('invoice=invoice');
  fireEvent.click(screen.getByRole('button', { name: 'Review credit note' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).toContain('INV-1');
  expect(
    (screen.getByLabelText('Post immediately') as HTMLInputElement).checked
  ).toBe(false);
  expect(
    (screen.getByLabelText('Amount (ex-tax)') as HTMLInputElement).value
  ).toBe('');
  expect(
    screen.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')
  ).toBe(true);
});
it('fully refunded invoices do not display as ordinary cash-paid invoices', async () => {
  vi.mocked(arApService.invoices).mockResolvedValue({
    success: true,
    data: [
      {
        ...invoice,
        source: 'pos',
        amountPaid: 0,
        creditedAmount: 100,
        refundedAmount: 100,
      },
    ],
    pagination: { page: 1, pages: 1, total: 1, limit: 25 },
  });
  render(<ArApDocsView side="customer" />);
  await screen.findAllByText('INV-1');
  expect(screen.getAllByText('Fully refunded').length).toBeGreaterThan(0);
  expect(
    screen.getAllByText('Paid').every((element) => element.tagName === 'BUTTON')
  ).toBe(true);
});
