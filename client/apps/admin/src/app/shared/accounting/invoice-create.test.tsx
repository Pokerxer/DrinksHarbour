// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InvoiceCreate from './invoice-create';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
const context = vi.hoisted(() => ({
  token: 'token',
  draft: 'draft-1',
  auth: 'authenticated',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: context.token ? { user: { token: context.token } } : null,
    status: context.auth,
  }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ draft: context.draft }),
}));
// The draft loader hands an authoritative source to the existing editor. Its
// downstream pricing/editor is tested separately; no financial writes here.
vi.mock('@/app/shared/sales/sales-create', () => ({
  default: ({ initial }: { initial?: SalesOrder }) => (
    <p>Loaded {initial?.soNumber || 'new draft'}</p>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  context.token = 'token';
  context.auth = 'authenticated';
});
it('offers a retry for a failed draft read and reopens the saved source', async () => {
  vi.spyOn(salesOrderService, 'get')
    .mockRejectedValueOnce(new Error('Connection closed'))
    .mockResolvedValueOnce({
      success: true,
      data: {
        _id: 'draft-1',
        soNumber: 'SO-1',
        docType: 'quotation',
        quoteStatus: 'draft',
      } as SalesOrder,
    });
  render(<InvoiceCreate />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry draft' }));
  expect(await screen.findByText('Loaded SO-1')).toBeTruthy();
  expect(salesOrderService.get).toHaveBeenCalledWith('draft-1', 'token');
});
it('shows sign-in guidance rather than indefinite draft loading', () => {
  context.token = '';
  context.auth = 'unauthenticated';
  render(<InvoiceCreate />);
  expect(screen.getByText(/sign in to create/i)).toBeTruthy();
});
it('blocks an already-issued quotation source even when its order fields are stale', async () => {
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: {
      _id: 'draft-1',
      soNumber: 'SO-1',
      docType: 'quotation',
      quoteStatus: 'draft',
      invoiceIssuedAt: '2026-10-13',
    } as SalesOrder,
  });
  render(<InvoiceCreate />);
  expect(await screen.findByText(/already been issued/i)).toBeTruthy();
  expect(screen.queryByText('Loaded SO-1')).toBeNull();
});
