import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { groupMovements, movementGroupLabel } from './inventory-movement-groups';
it('groups by actual warehouse and product identities with readable labels', () => {
  const rows = [
    {
      _id: 'in',
      type: 'transfer_in',
      category: 'transfer',
      warehouse: { _id: 'city', name: 'City' },
      sourceWarehouse: { _id: 'depot', name: 'Depot' },
      destinationWarehouse: { _id: 'city', name: 'City' },
      subProduct: { _id: 'a', sku: 'A', name: 'Wine' },
    },
    {
      _id: 'out',
      type: 'transfer_out',
      category: 'transfer',
      warehouse: { _id: 'depot', name: 'Depot' },
      sourceWarehouse: { _id: 'depot', name: 'Depot' },
      destinationWarehouse: { _id: 'city', name: 'City' },
      subProduct: { _id: 'b', sku: 'B', name: 'Wine' },
    },
  ] as InventoryMovement[];
  expect(groupMovements(rows, 'warehouse')).toHaveLength(2);
  expect(groupMovements(rows, 'product')).toHaveLength(2);
  expect(movementGroupLabel('product', 'internal-id', [rows[0]])).toBe('Wine · A');
  expect(movementGroupLabel('warehouse', 'internal-id', [rows[1]])).toBe('Depot');
});
it('groups receipt types by their purchase/manual/import origin rather than the shared received type', () => {
  const rows = [
    { type: 'received', relatedPurchaseOrder: 'po' },
    { type: 'received', source: 'manual' },
    { type: 'received', reference: 'bulk-import' },
  ] as InventoryMovement[];
  expect(groupMovements(rows, 'type', true).map(([name]) => name)).toEqual([
    'Purchase receipt',
    'Manual receipt',
    'Imported stock',
  ]);
  expect(groupMovements(rows, 'type')).toHaveLength(1);
});
