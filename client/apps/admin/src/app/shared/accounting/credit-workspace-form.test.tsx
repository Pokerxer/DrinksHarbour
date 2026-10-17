// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
import CreditWorkspaceForm from './credit-workspace-form';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
const invoice = {
  _id: 'inv',
  date: '2026-10-14',
  total: 200,
  amountPaid: 0,
  paymentStatus: 'unpaid',
  orderNumber: 'INV-1',
  source: 'sales',
  state: 'posted',
  currency: 'NGN',
  outstanding: 100,
  customerSnapshot: { name: 'Ada' },
  customer: { _id: 'ada', firstName: 'Ada', lastName: 'Obi' },
} as OpenInvoice;
beforeEach(() => {
  vi.spyOn(arApService, 'invoices').mockResolvedValue({
    success: true,
    data: [invoice],
    pagination: { page: 1, pages: 2, total: 101, limit: 100 },
  });
  vi.spyOn(arApService, 'customers').mockResolvedValue({
    success: true,
    data: [{ _id: 'other', firstName: 'Obi', lastName: 'A' }],
  } as Awaited<ReturnType<typeof arApService.customers>>);
  vi.spyOn(arApService, 'createCreditNote').mockResolvedValue({
    success: true,
    data: {},
  } as Awaited<ReturnType<typeof arApService.createCreditNote>>);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('new workspace credits default to draft and switching to an invoice clears the unrelated chosen customer', async () => {
  render(
    <CreditWorkspaceForm token="token" onClose={() => {}} onSaved={() => {}} />
  );
  await screen.findByRole('option', { name: 'Obi A' });
  expect(
    (screen.getByLabelText('Post immediately') as HTMLInputElement).checked
  ).toBe(false);
  fireEvent.change(screen.getByLabelText(/Customer account/), {
    target: { value: 'other' },
  });
  fireEvent.change(screen.getByLabelText(/Against invoice/), {
    target: { value: 'inv' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(arApService.createCreditNote).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        salesOrder: 'inv',
        customer: undefined,
        post: false,
      })
    )
  );
  expect(
    screen.getByRole('button', { name: 'Load more invoices' })
  ).toBeTruthy();
});
it('customer-choice failure exposes retry rather than silently offering an empty selector', async () => {
  vi.mocked(arApService.customers).mockRejectedValueOnce(
    new Error('Customer connection closed')
  );
  render(
    <CreditWorkspaceForm token="token" onClose={() => {}} onSaved={() => {}} />
  );
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry customers' }));
  await screen.findByRole('option', { name: 'Obi A' });
});
it('loading more invoice choices preserves a reviewed credit amount', async () => {
  vi.mocked(arApService.invoices)
    .mockResolvedValueOnce({
      success: true,
      data: [invoice],
      pagination: { page: 1, pages: 2, total: 101, limit: 100 },
    })
    .mockResolvedValueOnce({
      success: true,
      data: [{ ...invoice, _id: 'second', orderNumber: 'INV-2' }],
      pagination: { page: 2, pages: 2, total: 101, limit: 100 },
    });
  render(
    <CreditWorkspaceForm token="token" onClose={() => {}} onSaved={() => {}} />
  );
  await screen.findByRole('option', { name: /INV-1/ });
  fireEvent.change(screen.getByLabelText(/Against invoice/), {
    target: { value: 'inv' },
  });
  fireEvent.change(screen.getByLabelText('Amount (ex-tax)'), {
    target: { value: '12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load more invoices' }));
  await screen.findByRole('option', { name: /INV-2/ });
  expect(
    (screen.getByLabelText('Amount (ex-tax)') as HTMLInputElement).value
  ).toBe('12');
});
