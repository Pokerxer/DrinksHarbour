// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import PurchasesPODetail from './purchases-po-detail';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'test-token' } } }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: null }),
}));
vi.mock('@/services/vendorReturn.service', () => ({
  vendorReturnService: { getVendorReturns: async () => ({ data: [] }) },
}));

const draft = {
  _id: 'order-1',
  poNumber: 'PO-001',
  currency: 'NGN',
  status: 'draft',
} as const;

function renderOrder(order: Record<string, unknown> = {}) {
  const load = vi
    .spyOn(purchaseOrderService, 'getPurchaseOrder')
    .mockResolvedValue({
      success: true,
      data: { ...draft, items: [], ...order },
    });
  render(<PurchasesPODetail id={draft._id} />);
  return load;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  replace.mockClear();
});

it('opens the existing editor and deletes a draft after confirmation', async () => {
  const remove = vi
    .spyOn(purchaseOrderService, 'deletePurchaseOrder')
    .mockResolvedValue({ success: true });
  renderOrder();

  const edit = await screen.findByRole('link', { name: 'Edit' });
  expect(edit.getAttribute('href')).toBe('/purchases/order-1/edit');

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete purchase order?' });
  expect(within(dialog).getByText(/PO-001/)).toBeTruthy();
  expect(remove).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/purchases'));
  expect(remove).toHaveBeenCalledExactlyOnceWith('order-1', 'test-token');
});

it('keeps the purchase when deletion is cancelled', async () => {
  const remove = vi.spyOn(purchaseOrderService, 'deletePurchaseOrder');
  renderOrder();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Cancel'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(remove).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it.each([
  ['confirmed', { status: 'confirmed' }],
  ['partially received', { status: 'partially_received' }],
  ['locked', { isLocked: true }],
  ['draft with receipt activity', { isPartiallyReceived: true }],
  ['converted RFQ', { type: 'rfq', rfqStatus: 'converted' }],
])('hides edit and delete for a %s order', async (_description, fields) => {
  renderOrder(fields);
  await screen.findByRole('heading', { name: 'PO-001' });
  expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
});

const product = {
  quantity: 5,
  receivedQty: 0,
  postedQty: 0,
  subProductName: 'Bottle',
};
const confirmedQuotation = {
  status: 'confirmed',
  type: 'rfq',
  poNumber: 'RFQ-001',
  rfqStatus: 'sent',
  items: [product],
};

it('lets a confirmed quotation be cancelled before its first receipt', async () => {
  const update = vi
    .spyOn(purchaseOrderService, 'updatePurchaseOrderStatus')
    .mockResolvedValue({
      success: true,
      data: { ...draft, status: 'cancelled', items: [] },
    });
  const load = renderOrder(confirmedQuotation);
  await screen.findByRole('link', { name: 'Receive Products' });
  expect(screen.queryByRole('link', { name: 'Create Bill' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Return Products' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel RFQ' }));
  const dialog = screen.getByRole('dialog', { name: 'Cancel quotation?' });
  expect(within(dialog).getByText(/RFQ-001/)).toBeTruthy();
  expect(update).not.toHaveBeenCalled();
  load.mockResolvedValue({
    success: true,
    data: { ...draft, status: 'cancelled', items: [] },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel RFQ' }));
  await screen.findByText('Cancelled');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    'order-1',
    'cancelled',
    'test-token'
  );
  expect(screen.queryByRole('link', { name: 'Receive Products' })).toBeNull();
});

it.each([
  [
    'partial receipt awaiting validation',
    'partially_received',
    2,
    0,
    ['Receive Products', 'Validate Receipt'],
  ],
  [
    'posted partial receipt',
    'partially_received',
    2,
    2,
    ['Receive Products', 'Return Products'],
  ],
  [
    'full receipt awaiting validation',
    'received',
    5,
    0,
    ['Validate Receipt', 'Create Bill'],
  ],
  ['validated receipt', 'validated', 5, 5, ['Create Bill', 'Return Products']],
] as const)(
  'shows the applicable actions for a %s',
  async (_label, status, receivedQty, postedQty, actions) => {
    renderOrder({
      ...confirmedQuotation,
      status,
      vendor: 'vendor-1',
      items: [{ ...product, receivedQty, postedQty }],
    });
    await screen.findByRole('heading', { name: 'RFQ-001' });

    for (const name of [
      'Receive Products',
      'Validate Receipt',
      'Create Bill',
      'Return Products',
    ]) {
      expect(!!screen.queryByRole('link', { name })).toBe(
        actions.some((action) => action === name)
      );
    }
    expect(screen.queryByRole('button', { name: 'Cancel RFQ' })).toBeNull();
  }
);

it('opens the existing vendor bill once one has been created', async () => {
  renderOrder({
    ...confirmedQuotation,
    status: 'validated',
    vendor: 'vendor-1',
    items: [{ ...product, receivedQty: 5, postedQty: 5 }],
    activeVendorBill: { _id: 'bill-1', billNumber: 'BIL-001' },
  });
  expect(
    (await screen.findByRole('link', { name: 'View Bill' })).getAttribute(
      'href'
    )
  ).toBe('/purchases/bills/bill-1');
  expect(screen.queryByRole('link', { name: 'Create Bill' })).toBeNull();
});
