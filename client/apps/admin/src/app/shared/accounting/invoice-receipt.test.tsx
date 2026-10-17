// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import PaymentFormModal from './payment-form-modal';
import { arApService, type OpenInvoice } from '@/services/arAp.service';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
const invoice: OpenInvoice = {
  _id: 'one',
  orderNumber: 'INV-1',
  date: '2026-10-01',
  total: 100,
  amountPaid: 0,
  outstanding: 100,
  paymentStatus: 'unpaid',
  customerSnapshot: { name: 'Ada' },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('allows retrying failed allocation loading without closing the receipt', async () => {
  vi.spyOn(arApService, 'invoices')
    .mockRejectedValueOnce(new Error('Connection closed'))
    .mockResolvedValueOnce({ success: true, data: [invoice] });
  render(
    <PaymentFormModal
      side="customer"
      initialDocument={invoice}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry allocations' })
  );
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(
    screen
      .getByRole('button', { name: 'Record receipt' })
      .hasAttribute('disabled')
  ).toBe(false);
});
it('does not invent an open balance for a settled invoice missing from allocation reads', async () => {
  vi.spyOn(arApService, 'invoices').mockResolvedValue({
    success: true,
    data: [],
  });
  const save = vi.spyOn(arApService, 'createPayment');
  render(
    <PaymentFormModal
      side="customer"
      initialDocument={invoice}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />
  );
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Record receipt' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

it('receipt allocation requests only eligible open Sales invoices', async () => {
  vi.spyOn(arApService, 'customers').mockResolvedValue({
    success: true,
    data: [],
  });
  const fetch = vi
    .spyOn(arApService, 'invoices')
    .mockResolvedValue({ success: true, data: [invoice] });
  render(
    <PaymentFormModal side="customer" onClose={vi.fn()} onSaved={vi.fn()} />
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ scope: 'open' })
    )
  );
});
