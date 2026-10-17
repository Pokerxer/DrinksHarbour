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
import PaymentFormModal from './payment-form-modal';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
const invoice: OpenInvoice = {
  _id: 'inv',
  date: '2026-10-14',
  total: 80,
  amountPaid: 0,
  outstanding: 80,
  paymentStatus: 'unpaid',
  orderNumber: 'INV-1',
  source: 'sales',
  state: 'posted',
  customer: { _id: 'ada', firstName: 'Ada', lastName: 'Obi' },
};
beforeEach(() => {
  vi.spyOn(arApService, 'invoices').mockResolvedValue({
    success: true,
    data: [invoice],
    pagination: { page: 1, pages: 2, total: 101, limit: 100 },
  });
  vi.spyOn(arApService, 'customers').mockResolvedValue({
    success: true,
    data: [{ _id: 'ada', firstName: 'Ada', lastName: 'Obi' }],
  } as Awaited<ReturnType<typeof arApService.customers>>);
  vi.spyOn(arApService, 'vendors').mockResolvedValue({
    success: true,
    data: [],
  });
  vi.spyOn(arApService, 'createPayment').mockResolvedValue({
    success: true,
    data: {},
  } as Awaited<ReturnType<typeof arApService.createPayment>>);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('records an unallocated receipt against a selected customer account with a clear remainder preview', async () => {
  render(
    <PaymentFormModal side="customer" onClose={() => {}} onSaved={() => {}} />
  );
  await screen.findByRole('option', { name: 'Ada Obi' });
  fireEvent.change(screen.getByLabelText('Customer account'), {
    target: { value: 'ada' },
  });
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '100' },
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Record receipt' })
        .hasAttribute('disabled')
    ).toBe(false)
  );
  expect(screen.getByText('Unallocated remainder')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Record receipt' }));
  await waitFor(() =>
    expect(arApService.createPayment).toHaveBeenCalledWith(
      'token',
      'customer',
      expect.objectContaining({ customer: 'ada', amount: 100, allocations: [] })
    )
  );
});
it('exposes further allocation pages and preserves the recorded amount when they load', async () => {
  vi.mocked(arApService.invoices)
    .mockResolvedValueOnce({
      success: true,
      data: [invoice],
      pagination: { page: 1, pages: 2, total: 101, limit: 100 },
    })
    .mockResolvedValueOnce({
      success: true,
      data: [{ ...invoice, _id: 'inv2', orderNumber: 'INV-2' }],
      pagination: { page: 2, pages: 2, total: 101, limit: 100 },
    });
  render(
    <PaymentFormModal side="customer" onClose={() => {}} onSaved={() => {}} />
  );
  const more = await screen.findByRole('button', {
    name: 'Load more allocation documents',
  });
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '100' },
  });
  fireEvent.click(more);
  await waitFor(() =>
    expect(arApService.invoices).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ page: 2 })
    )
  );
  expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe(
    '100'
  );
});
