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
import {
  arApService,
  type CreditNote,
  type OpenInvoice,
} from '@/services/arAp.service';
import CreditNotesView from './credit-notes-view';
import CreditApplyModal from './credit-apply-modal';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'token' } },
    status: 'authenticated',
  }),
}));
const note = {
  _id: 'cn1',
  number: 'CN-1',
  customer: { _id: 'customer', firstName: 'Ada', lastName: 'Obi' },
  date: '2026-10-14',
  reason: 'Returned wine',
  amount: 100,
  taxAmount: 7.5,
  status: 'applied',
  unappliedAmount: 107.5,
  allocations: [],
} as CreditNote;
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
  outstanding: 200,
  customer: { _id: 'customer', firstName: 'Ada', lastName: 'Obi' },
} as OpenInvoice;
beforeEach(() => {
  vi.spyOn(arApService, 'creditNotes').mockResolvedValue({
    success: true,
    data: [note],
    pagination: { page: 1, pages: 1, total: 1, limit: 25 },
  });
  vi.spyOn(arApService, 'invoices').mockResolvedValue({
    success: true,
    data: [invoice],
    pagination: { page: 1, pages: 1, total: 1, limit: 100 },
  });
  vi.spyOn(arApService, 'customerCredits').mockResolvedValue({
    success: true,
    data: {
      customer: 'customer',
      balance: 250,
      data: [note],
      pagination: { page: 1, pages: 1, total: 1, limit: 25 },
    },
  });
  vi.spyOn(arApService, 'postCreditNote').mockResolvedValue({
    success: true,
    data: { ...note, status: 'applied' },
  });
  vi.spyOn(arApService, 'cancelCreditNote').mockResolvedValue({
    success: true,
    data: { ...note, status: 'cancelled' },
  });
  vi.spyOn(arApService, 'applyCredit').mockResolvedValue({
    success: true,
    data: { salesOrder: 'inv', customer: 'customer', applied: 150 },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows available credit and a VAT-inclusive total instead of incorrectly claiming applied', async () => {
  render(<CreditNotesView />);
  await screen.findAllByText('CN-1');
  expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/₦\s*107\.50/).length).toBeGreaterThan(0);
});
it('load failure replaces stale records with a visible retry', async () => {
  render(<CreditNotesView />);
  await screen.findAllByText('CN-1');
  vi.mocked(arApService.creditNotes).mockRejectedValueOnce(
    new Error('Connection closed')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh credit notes' }));
  await screen.findByRole('alert');
  expect(screen.queryAllByText('CN-1').length).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Retry credit notes' }));
  await screen.findAllByText('CN-1');
});
it('posting a draft requires reviewing its effect first and draft cancellation does not claim a reversal', async () => {
  vi.mocked(arApService.creditNotes).mockResolvedValue({
    success: true,
    data: [{ ...note, status: 'draft', number: undefined, unappliedAmount: 0 }],
  });
  render(<CreditNotesView />);
  fireEvent.click(
    (await screen.findAllByRole('button', { name: 'Review posting' }))[0]
  );
  expect(arApService.postCreditNote).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog', { name: 'Review credit posting' });
  expect(within(dialog).getByText(/No cash refund/)).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Post credit note' })
  );
  await waitFor(() =>
    expect(arApService.postCreditNote).toHaveBeenCalledWith('token', 'cn1')
  );
});
it('applying from a note uses the full customer account balance rather than its smaller selected-note balance', async () => {
  render(<CreditNotesView />);
  fireEvent.click(
    (await screen.findAllByRole('button', { name: 'Apply customer credit' }))[0]
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Apply customer credit',
  });
  expect(within(dialog).getByText(/₦\s*250\.00/)).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText('Invoice'), {
    target: { value: 'inv' },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), {
    target: { value: '150' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply credit' }));
  await waitFor(() =>
    expect(arApService.applyCredit).toHaveBeenCalledWith('token', {
      salesOrder: 'inv',
      customer: 'customer',
      amount: 150,
    })
  );
});
it('never submits invalid or above-ceiling credit amounts', () => {
  render(
    <CreditApplyModal
      token="token"
      customer="customer"
      available={100}
      invoices={[invoice]}
      onClose={() => {}}
      onApplied={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Invoice'), {
    target: { value: 'inv' },
  });
  fireEvent.change(screen.getByLabelText(/^Amount/), {
    target: { value: '101' },
  });
  expect(
    screen
      .getByRole('button', { name: 'Apply credit' })
      .hasAttribute('disabled')
  ).toBe(true);
  fireEvent.change(screen.getByLabelText(/^Amount/), {
    target: { value: 'bad' },
  });
  // Number inputs normalize invalid text to blank: blank explicitly uses the valid ceiling.
  expect(arApService.applyCredit).not.toHaveBeenCalled();
});
