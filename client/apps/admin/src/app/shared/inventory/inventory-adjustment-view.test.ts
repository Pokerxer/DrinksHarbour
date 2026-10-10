import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { adjustmentStats, adjustmentDirection } from './inventory-adjustment-view';
import { PRESETS } from './inventory-movements-presets';
const row = (extra: Partial<InventoryMovement> = {}) =>
  ({
    type: 'adjustment_in',
    category: 'in',
    status: 'confirmed',
    quantity: 5,
    totalCost: 50,
    ...extra,
  }) as InventoryMovement;
it('uses posted balances for corrections, keeps pending/excluded separate and discloses unknown cost', () => {
  const rows = [
    row(),
    row({ type: 'adjustment_out', quantity: 100, quantityBefore: 4, quantityAfter: 1 }),
    row({ quantityBefore: 0, quantityAfter: 0 }),
    row({ status: 'pending', quantity: 8 }),
    row({ status: 'cancelled', quantity: 20 }),
    row({ quantity: 2, totalCost: undefined }),
  ];
  expect(adjustmentStats(rows)).toMatchObject({
    increase: 7,
    decrease: 3,
    net: 4,
    pending: 8,
    pendingLines: 1,
    excluded: 1,
    unchanged: 1,
    cost: 100,
    unpriced: 1,
  });
  expect(
    adjustmentDirection(row({ type: 'adjustment_in', quantityBefore: 8, quantityAfter: 3 })),
  ).toBe('out');
  expect(PRESETS.moves.tabs.find((t) => t.key === 'adjustment')?.match?.(row())).toBe(true);
});
