import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { receiptKind, receiptStats } from './inventory-receipt-view';
const row = (extra: Partial<InventoryMovement> = {}) =>
  ({
    type: 'received',
    category: 'in',
    status: 'confirmed',
    quantity: 3,
    totalCost: 30,
    ...extra,
  }) as InventoryMovement;
it('uses recorded posted balances, never adds pending/cancelled quantities or invented costs', () => {
  expect(
    receiptStats([
      row({ quantityBefore: 5, quantityAfter: 7 }),
      row({ type: 'return', totalCost: undefined }),
      row({ status: 'pending', quantity: 8 }),
      row({ status: 'cancelled', quantity: 10 }),
      row({ type: 'released', quantity: 20 }),
    ]),
  ).toMatchObject({
    received: 5,
    pending: 8,
    pendingLines: 1,
    confirmedLines: 2,
    excluded: 1,
    cost: 30,
    unpriced: 1,
  });
});
it('keeps returns separate from purchases and does not mistake unrelated system receipts for imports', () => {
  expect(receiptKind(row({ type: 'return', relatedPurchaseOrder: 'po' }))).toBe('return');
  expect(receiptKind(row({ source: 'system' }))).toBe('received');
  expect(receiptKind(row({ reference: 'BULK-IMPORT', referenceType: 'purchase_order' }))).toBe(
    'opening',
  );
});
