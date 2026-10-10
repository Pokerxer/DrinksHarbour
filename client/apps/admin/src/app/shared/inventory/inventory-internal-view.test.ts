import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { internalStats, matchesInternalRoute } from './inventory-internal-view';
const row = (changes: Partial<InventoryMovement> = {}) =>
  ({
    type: 'transfer_in',
    category: 'transfer',
    quantity: 10,
    status: 'confirmed',
    totalCost: 100,
    sourceWarehouse: 'origin',
    destinationWarehouse: 'holding',
    ...changes,
  }) as InventoryMovement;
it('separates original transfers and both return types without netting away transferred history', () => {
  const stats = internalStats([
    row(),
    row({ type: 'transfer_out' }),
    row({
      type: 'return',
      category: 'in',
      quantity: 2,
      totalCost: 20,
      reference: 'Return of transfer TRF-1',
    }),
    row({
      type: 'transfer_out',
      quantity: 2,
      totalCost: 20,
      reference: 'Return of transfer TRF-1',
    }),
    row({ status: 'pending', quantity: 8 }),
    row({ status: 'cancelled', quantity: 20 }),
    row({ type: 'received', category: 'in', quantity: 99 }),
  ]);
  expect(stats).toMatchObject({
    transferIn: 10,
    transferOut: 10,
    returnIn: 2,
    returnOut: 2,
    net: 0,
    pending: 8,
    pendingLines: 1,
    cost: 240,
    unpriced: 0,
  });
});
it('uses actual posted balances, discloses missing costs and matches directed warehouse IDs', () => {
  expect(
    internalStats([row({ quantityBefore: 8, quantityAfter: 10, totalCost: undefined })]),
  ).toMatchObject({ transferIn: 2, net: 2, unpriced: 1, cost: 0 });
  expect(matchesInternalRoute(row(), 'origin', 'holding')).toBe(true);
  expect(matchesInternalRoute(row(), 'holding', 'origin')).toBe(false);
});
