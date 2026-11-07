// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PendingProductsPage from '@/app/(hydrogen)/products/pending/page';
import PendingQueueView from './pending-queue-view';
import {
  productService,
  type PendingProductDTO,
} from '@/services/product.service';

vi.mock('@/app/shared/ecommerce/ecommerce-page-header', () => ({
  default: () => null,
}));
vi.mock('@/config/site.config', () => ({ metaObject: () => ({}) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { role: 'super_admin', token: 'token-1' } },
  }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/services/product.service', () => ({
  productService: {
    getPendingProducts: vi.fn(),
    approveProduct: vi.fn(),
    rejectProduct: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const pageOf = (products: PendingProductDTO[], total = products.length) => ({
  products,
  pagination: {
    page: 1,
    limit: 20,
    total,
    pages: Math.ceil(total / 20),
    hasNext: false,
    hasPrev: false,
  },
});

const privateRow: PendingProductDTO = {
  _id: 'p1',
  name: 'Zambezi Dry Gin',
  slug: 'zambezi-dry-gin',
  type: 'spirit',
  status: 'pending',
  imageUrl: '/gin.jpg',
  publicationScope: 'tenant_private',
  owningTenantName: 'Havour Wine',
  submittingTenantName: 'Havour Wine',
  submissionSource: 'tenant',
  createdAt: '2026-10-01T10:00:00.000Z',
};

const legacyRow: PendingProductDTO = {
  _id: 'p2',
  name: 'Cape Chardonnay',
  slug: 'cape-chardonnay',
  type: 'wine',
  status: 'pending',
  createdAt: '2026-09-20T09:00:00.000Z',
};

it('renders the pending approvals page with queue rows for both tenant-private and legacy pending products', async () => {
  vi.mocked(productService.getPendingProducts).mockResolvedValue(
    pageOf([privateRow, legacyRow])
  );
  render(<PendingProductsPage />);

  await screen.findByText('Zambezi Dry Gin');
  expect(screen.getByText('Cape Chardonnay')).toBeTruthy();
  // Scope tags come from the shared PublicationScopeTag primitive.
  expect(screen.getByText('Store-only · Havour Wine')).toBeTruthy();
  // Submitted-source chip for tenant submissions.
  expect(screen.getAllByText(/Tenant/).length).toBeGreaterThan(0);
});

it('uses promotion wording for tenant-private rows and plain approve for legacy rows', async () => {
  vi.mocked(productService.getPendingProducts).mockResolvedValue(
    pageOf([privateRow, legacyRow])
  );
  render(<PendingQueueView />);

  await screen.findByText('Zambezi Dry Gin');
  const promote = screen.getByRole('button', {
    name: 'Approve & publish to marketplace',
  });
  // Testing-library name matching is full-string by default, so the plain
  // legacy label never matches the promotion copy.
  const plain = screen.getByRole('button', { name: 'Approve' });
  expect(promote).toBeTruthy();
  expect(plain).toBeTruthy();
});

it('approves, reports success and refetches the queue', async () => {
  vi.mocked(productService.getPendingProducts)
    .mockResolvedValueOnce(pageOf([privateRow]))
    .mockResolvedValueOnce(pageOf([]));
  vi.mocked(productService.approveProduct).mockResolvedValue({
    success: true,
  } as any);
  render(<PendingQueueView />);

  const button = await screen.findByRole('button', {
    name: 'Approve & publish to marketplace',
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(productService.approveProduct).toHaveBeenCalledWith(
      'p1',
      'token-1'
    )
  );
  // After-action refetch instead of optimistic removal.
  await waitFor(() =>
    expect(productService.getPendingProducts).toHaveBeenCalledTimes(2)
  );
});

it('rejects only after a reason of at least three characters is given', async () => {
  vi.mocked(productService.getPendingProducts).mockResolvedValue(
    pageOf([privateRow])
  );
  vi.mocked(productService.rejectProduct).mockResolvedValue({
    success: true,
  } as any);
  render(<PendingQueueView />);

  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Reject product',
  });
  const input = screen.getByLabelText(/Rejection reason/i);
  const submit = screen.getByRole('button', {
    name: 'Reject product',
  }) as HTMLButtonElement;

  // Too short — server takes a real reason, the client refuses to send one.
  fireEvent.change(input, { target: { value: 'no' } });
  expect(submit.disabled).toBe(true);
  expect(productService.rejectProduct).not.toHaveBeenCalled();

  fireEvent.change(input, { target: { value: 'Duplicate of Cape Chardonnay' } });
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  await waitFor(() =>
    expect(productService.rejectProduct).toHaveBeenCalledWith(
      'p1',
      'token-1',
      'Duplicate of Cape Chardonnay'
    )
  );
});

it('keeps the reject modal open with the typed reason intact when the rejection fails', async () => {
  vi.mocked(productService.getPendingProducts).mockResolvedValue(
    pageOf([privateRow])
  );
  vi.mocked(productService.rejectProduct).mockRejectedValue(
    new Error('Database temporarily unavailable')
  );
  render(<PendingQueueView />);

  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  await screen.findByRole('dialog', { name: 'Reject product' });
  const input = screen.getByLabelText(/Rejection reason/i);
  fireEvent.change(input, { target: { value: 'Duplicate of Cape Chardonnay' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reject product' }));

  await waitFor(() =>
    expect(productService.rejectProduct).toHaveBeenCalledWith(
      'p1',
      'token-1',
      'Duplicate of Cape Chardonnay'
    )
  );
  // The failure is announced inside the modal (next to the field it belongs
  // to) instead of closing it — the typed reason is never lost.
  await screen.findAllByText(/Database temporarily unavailable/);
  expect(
    screen.getByRole('dialog', { name: 'Reject product' })
  ).toBeTruthy();
  expect(
    (screen.getByLabelText(/Rejection reason/i) as HTMLTextAreaElement).value
  ).toBe('Duplicate of Cape Chardonnay');
});

it('shows an empty state when the queue has nothing pending', async () => {
  vi.mocked(productService.getPendingProducts).mockResolvedValue(pageOf([]));
  render(<PendingQueueView />);
  await screen.findByText(/Nothing is pending approval/);
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
});

it('shows a retryable error state instead of rows when the queue fails', async () => {
  vi.mocked(productService.getPendingProducts).mockRejectedValue(
    new Error('Database temporarily unavailable')
  );
  render(<PendingQueueView />);
  await screen.findByText(/Database temporarily unavailable/);
  const retry = screen.getByRole('button', { name: /Retry/i });
  expect(retry).toBeTruthy();
});
