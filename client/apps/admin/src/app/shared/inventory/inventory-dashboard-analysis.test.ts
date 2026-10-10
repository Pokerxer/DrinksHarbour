import { expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import type { InventoryMovement } from '@/services/inventory.service';
import {
  filterStock,
  filterHistory,
  stockTotals,
  movementTotals,
  buildHistoryFlow,
} from './inventory-dashboard-analysis';
const rows = [
  {
    _id: 'a1',
    subProductId: 'a',
    warehouseId: 'w1',
    currentQuantity: 10,
    costPrice: 2,
    sellingPrice: 5,
    minStockLevel: 2,
  },
  {
    _id: 'a2',
    subProductId: 'a',
    warehouseId: 'w2',
    currentQuantity: -1,
    costPrice: 3,
    sellingPrice: 6,
    minStockLevel: 2,
  },
  {
    _id: 'b1',
    subProductId: 'b',
    warehouseId: 'w1',
    currentQuantity: 0,
    costPrice: 8,
    sellingPrice: 9,
    minStockLevel: 2,
  },
] as StockRow[];
const filters = {
  products: ['a', 'b'],
  warehouse: 'w1',
  health: '',
  from: '',
  to: '',
  reference: '',
};
const movement = (
  id: string,
  warehouse: string,
  type: string,
  category: string,
  reference = 'Transfer ST1',
  quantity = 10,
) =>
  ({
    _id: id,
    subProduct: 'a',
    warehouse,
    type,
    category,
    reference,
    quantity,
    status: 'confirmed',
    createdAt: '2026-10-04T23:55:00Z',
    sourceWarehouse: 'w1',
    destinationWarehouse: 'w2',
  }) as InventoryMovement;
it('products match any selection, warehouse and health intersect without mutating rows', () => {
  expect(filterStock(rows, filters).map((r) => r._id)).toEqual(['a1', 'b1']);
  expect(filterStock(rows, { ...filters, health: 'out' }).map((r) => r._id)).toEqual(['b1']);
  expect(rows).toHaveLength(3);
});
it('stock totals use only selected warehouse quantities including zero and negatives', () => {
  expect(stockTotals(filterStock(rows, filters))).toEqual({
    units: 10,
    cost: 20,
    retail: 50,
    profit: 30,
    low: 0,
    out: 1,
    lines: 2,
  });
  expect(stockTotals(rows).cost).toBe(17);
});
it('history selects actual stock leg warehouse, not both transfer endpoints', () => {
  const moves = [
    movement('out', 'w1', 'transfer_out', 'transfer'),
    movement('in', 'w2', 'transfer_in', 'transfer'),
  ];
  expect(filterHistory(moves, filters).map((m) => m._id)).toEqual(['out']);
});
it('history dates and references intersect product selections with an inclusive UTC end date', () => {
  expect(
    filterHistory([movement('out', 'w1', 'transfer_out', 'transfer')], {
      ...filters,
      from: '2026-10-04',
      to: '2026-10-04',
      reference: 'st1',
    }),
  ).toHaveLength(1);
  expect(
    filterHistory([movement('out', 'w1', 'transfer_out', 'transfer')], {
      ...filters,
      to: '2026-10-03',
    }),
  ).toEqual([]);
});
it('returns undo original transfer directions rather than inflate gross transfers or receipts', () => {
  const moves = [
    movement('out', 'w1', 'transfer_out', 'transfer'),
    movement('in', 'w2', 'transfer_in', 'transfer'),
    movement('return-out', 'w2', 'transfer_out', 'transfer', 'Return of transfer ST1', 3),
    movement('return-in', 'w1', 'return', 'in', 'Return of transfer ST1', 3),
    { ...movement('cancel', 'w1', 'received', 'in'), status: 'cancelled' },
  ];
  expect(movementTotals(filterHistory(moves, filters))).toMatchObject({
    transferIn: 0,
    transferOut: 10,
    transferReturnedIn: 3,
    transferReturnedOut: 0,
    netTransferIn: 0,
    netTransferOut: 7,
    received: 0,
  });
  expect(movementTotals(filterHistory(moves, { ...filters, warehouse: 'w2' }))).toMatchObject({
    transferIn: 10,
    netTransferIn: 7,
    transferOut: 0,
    netTransferOut: 0,
  });
});
it('flows sum every confirmed entry without counting transfer returns as receipts', () => {
  const moves = [
    movement('receipt', 'w1', 'received', 'in', 'PO', 5),
    movement('return', 'w1', 'return', 'in', 'Return of transfer ST1', 3),
    movement('supplier', 'w1', 'return', 'out', 'VR', 2),
  ];
  expect(buildHistoryFlow(moves)).toEqual([{ day: '2026-10-04', in: 5, out: 2, net: 3 }]);
});
