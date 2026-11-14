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
import PurchasesReceiptDetail from './purchases-receipt-detail';

const { push, query } = vi.hoisted(() => ({ push: vi.fn(), query: { value: 'mode=validate' } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query.value),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
vi.mock('@/services/warehouse.service', () => ({
  warehouseService: { getWarehouses: async () => ({ data: [{ _id: 'warehouse-1', name: 'Warehouse', isDefault: true }] }) },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
  query.value = 'mode=validate';
});

it('validates a recorded partial receipt without receiving the outstanding units', async () => {
  const data = {
    _id: 'purchase-1',
    poNumber: 'PO-001',
    status: 'partially_received',
    currency: 'NGN',
    items: [
      {
        _id: 'line-1',
        quantity: 5,
        receivedQty: 2,
        postedQty: 0,
        outstandingQty: 3,
        productName: 'Bottle',
        subProductName: 'Bottle',
        unitCost: 10,
        subProductId: 'product-1',
        sku: 'BOTTLE',
        packSize: 1,
        packQty: 0,
        unitPrice: 10,
        packPrice: 0,
        type: 'product',
      },
    ],
  } as const;
  vi.spyOn(purchaseOrderService, 'getPurchaseOrder').mockResolvedValue({
    success: true,
    data: { ...data, items: [...data.items] },
  });
  const receive = vi.spyOn(purchaseOrderService, 'receivePurchaseOrder');
  const validate = vi
    .spyOn(purchaseOrderService, 'updatePurchaseOrderStatus')
    .mockResolvedValue({
      success: true,
      data: { ...data, items: [...data.items] },
    });
  render(<PurchasesReceiptDetail id="purchase-1" />);

  fireEvent.click(
    await screen.findByRole('button', { name: 'Validate & Add Stock' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Add to Stock' }));
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith('/purchases/purchase-1')
  );
  expect(receive).not.toHaveBeenCalled();
  expect(validate).toHaveBeenCalledExactlyOnceWith(
    'purchase-1',
    'validated',
    'token',
    undefined,
    undefined
  );
});

it('names each missing expiry, links to its input and clears resolved lines', async () => {
  query.value = '';
  const item = {
    quantity: 5, receivedQty: 0, productName: 'Bottle',
    subProductId: 'product-1', packSize: 1, packQty: 0,
    unitPrice: 10, packPrice: 0, type: 'product', tracksBatch: true,
  };
  const data = {
    _id: 'purchase-1', poNumber: 'PO-001', status: 'confirmed' as const,
    currency: 'NGN', warehouse: 'warehouse-1',
    items: [
      { ...item, _id: 'line-1', subProductName: 'Bardinet Grenadine Syrup', sizeName: '75cl', sku: 'SYRUP' },
      { ...item, _id: 'line-2', subProductName: 'Chamdor Red', sizeName: '75cl', sku: 'CHAMDOR' },
      { ...item, _id: 'line-3', subProductName: 'Whisky', sku: 'WHISKY', isAlcoholic: true },
    ],
  };
  vi.spyOn(purchaseOrderService, 'getPurchaseOrder').mockResolvedValue({ success: true, data });
  const receive = vi.spyOn(purchaseOrderService, 'receivePurchaseOrder')
    .mockResolvedValue({ success: true, data });
  const validate = vi.spyOn(purchaseOrderService, 'updatePurchaseOrderStatus')
    .mockResolvedValue({ success: true, data });
  render(<PurchasesReceiptDetail id="purchase-1" />);

  fireEvent.click(await screen.findByRole('button', { name: 'Validate & Add Stock' }));
  const confirm = screen.getByRole('button', { name: 'Yes, Add to Stock' });
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(confirm);

  const summary = screen.getByRole('alert');
  expect(document.activeElement).toBe(summary);
  const links = within(summary).getAllByRole('link');
  expect(links.map(link => link.textContent)).toEqual([
    'Bardinet Grenadine Syrup – 75cl (SYRUP)',
    'Chamdor Red – 75cl (CHAMDOR)',
  ]);
  expect(receive).not.toHaveBeenCalled();
  expect(validate).not.toHaveBeenCalled();
  const first = document.getElementById(links[0].getAttribute('href')!.slice(1))!;
  expect(first.getAttribute('aria-invalid')).toBe('true');

  fireEvent.change(first, { target: { value: '2027-08-15' } });
  expect(within(summary).getAllByRole('link')).toHaveLength(1);
  expect(first.getAttribute('aria-invalid')).toBeNull();

  const chamdor = screen.getByRole('row', { name: /Chamdor Red/ });
  fireEvent.change(within(chamdor).getByRole('spinbutton'), { target: { value: '0' } });
  expect(screen.queryByRole('alert')).toBeNull();

  fireEvent.click(confirm);
  await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
  expect(receive).toHaveBeenCalledWith('purchase-1', [
    expect.objectContaining({ itemId: 'line-1', expiryDate: '2027-08-15' }),
    expect.objectContaining({ itemId: 'line-3' }),
  ], 'token', 'warehouse-1');
});
