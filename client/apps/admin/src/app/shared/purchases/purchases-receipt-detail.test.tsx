// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import PurchasesReceiptDetail from './purchases-receipt-detail';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('mode=validate'),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
vi.mock('@/services/warehouse.service', () => ({
  warehouseService: { getWarehouses: async () => ({ data: [] }) },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
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
