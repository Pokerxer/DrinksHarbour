// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  arApService,
  type PaymentDoc,
  type OpenBill,
} from '@/services/arAp.service';
import Toolbar from './payments-workspace-toolbar';
import Detail from './payment-workspace-detail';
import PaymentForm from './payment-form-modal';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('vendor filter uses the Purchases vendor directory and applies the selected ID', async () => {
  vi.spyOn(arApService, 'vendors').mockResolvedValue({
    success: true,
    data: [{ _id: 'supplier', name: 'Supplier' }],
  } as Awaited<ReturnType<typeof arApService.vendors>>);
  const filter = vi.fn();
  render(
    <Toolbar
      token="token"
      side="vendor"
      filters={{ status: '', method: '', search: '', from: '', to: '' }}
      filter={filter}
      summary={{
        activeAmount: 0,
        allocated: 0,
        unallocated: 0,
        cancelledAmount: 0,
      }}
      loading={false}
      refresh={vi.fn()}
      create={vi.fn()}
    />
  );
  await screen.findByRole('option', { name: 'Supplier' });
  fireEvent.change(screen.getByLabelText('Vendor filter'), {
    target: { value: 'supplier' },
  });
  expect(filter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(filter).toHaveBeenCalledWith(
    expect.objectContaining({ vendor: 'supplier' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(filter).toHaveBeenLastCalledWith(
    expect.objectContaining({ vendor: '' })
  );
});
it('details link bill and purchase order and distinguish current bill status from receipt allocation', () => {
  const payment = {
    _id: 'payment',
    number: 'VPAY-1',
    vendorName: 'Supplier',
    amount: 30,
    method: 'cash',
    date: '2026-10-14',
    status: 'active',
    allocations: [
      {
        vendorBill: 'bill',
        amount: 30,
        document: {
          id: 'bill',
          label: 'BILL-1',
          href: '/purchases/bills/bill',
          status: 'partial',
          outstanding: 70,
        },
        purchaseOrder: { id: 'po', label: 'PO-1', href: '/purchases/po' },
      },
    ],
  } as PaymentDoc;
  render(
    <Detail
      side="vendor"
      payment={payment}
      busy={false}
      close={vi.fn()}
      confirm={vi.fn()}
    />
  );
  const dialog = screen.getByRole('dialog');
  expect(
    within(dialog).getByRole('link', { name: 'PO-1' }).getAttribute('href')
  ).toBe('/purchases/po');
  expect(within(dialog).getByText(/Current bill: Partially paid/)).toBeTruthy();
  expect(within(dialog).getByText(/Outstanding.*70\.00/)).toBeTruthy();
});
it('refreshing purchase bill balances prevents recording a now-settled allocation', async () => {
  const bill: OpenBill = {
    _id: 'bill',
    billNumber: 'BILL-1',
    date: '2026-10-14',
    vendorName: 'Supplier',
    status: 'confirmed',
    totalAmount: 100,
    paidAmount: 0,
    outstanding: 100,
  };
  vi.spyOn(arApService, 'bills')
    .mockResolvedValueOnce({ success: true, data: [bill] })
    .mockResolvedValue({ success: true, data: [] });
  const save = vi.spyOn(arApService, 'createPayment');
  render(
    <PaymentForm
      side="vendor"
      initialDocument={bill}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Record payment' })
        .hasAttribute('disabled')
    ).toBe(false)
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh bill balances' })
  );
  await screen.findByRole('alert');
  expect(
    screen
      .getByRole('button', { name: 'Record payment' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it('empty vendor payments explains Purchases records and links to purchase orders and bills', async () => {
  const { default: Results } = await import('./payments-workspace-results');
  render(
    <Results side="vendor" payments={[]} busy={false} details={vi.fn()} />
  );
  expect(
    screen.getByText(/Purchase orders do not record money paid/)
  ).toBeTruthy();
  expect(
    screen
      .getByRole('link', { name: 'Open purchase orders' })
      .getAttribute('href')
  ).toBe('/purchases');
  expect(
    screen.getByRole('link', { name: 'View vendor bills' }).getAttribute('href')
  ).toBe('/purchases/bills');
});
