import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { deliveryStats } from './inventory-delivery-view';
const row = (extra: Partial<InventoryMovement> = {}) =>
  ({
    type: 'sold',
    category: 'out',
    status: 'confirmed',
    quantity: 3,
    totalCost: 30,
    relatedOrder: 'same-order',
    ...extra,
  }) as InventoryMovement;
it('uses negative posted balances and counts distinct sales orders without adding pending or cancelled stock', () => {
  expect(
    deliveryStats([
      row({ quantityBefore: 8, quantityAfter: 6 }),
      row({ type: 'shipped', totalCost: undefined }),
      row({ status: 'pending', quantity: 8 }),
      row({ status: 'cancelled', quantity: 11 }),
      row({ type: 'reserved', quantity: 50 }),
      row({ type: 'return', category: 'in', quantity: 20 }),
    ]),
  ).toMatchObject({
    issued: 5,
    sold: 2,
    shipped: 3,
    pending: 8,
    pendingLines: 1,
    postedLines: 2,
    excluded: 1,
    cost: 30,
    unpriced: 1,
    orders: 1,
  });
});
it('does not mark a positive balance change as issued stock and preserves known zero cost', () => {
  expect(
    deliveryStats([row({ quantityBefore: 2, quantityAfter: 5 }), row({ totalCost: 0 })]),
  ).toMatchObject({ issued: 3, cost: 0, unpriced: 0, postedLines: 1 });
});
