import { expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import { buildTopProducts, sumUnits, countOutOfStock } from './inventory-dashboard-data';
const row = (i: number, quantity = i + 1) =>
  ({
    _id: `r${i}`,
    subProductId: `p${i}`,
    productName: `Product ${i} with a full descriptive name`,
    warehouseId: 'w',
    warehouseName: 'Warehouse',
    currentQuantity: quantity,
    costPrice: 2.25,
  }) as StockRow;
it('includes every product, preserving complete labels and zero/negative stock values', () => {
  const data = buildTopProducts([
    ...Array.from({ length: 45 }, (_, i) => row(i)),
    row(46, 0),
    row(47, -3),
  ]);
  expect(data).toHaveLength(47);
  expect(
    data.some((r) => r.name === 'Product 46 with a full descriptive name' && r.value === 0),
  ).toBe(true);
  expect(data.some((r) => r.value === -6.75)).toBe(true);
});
it('keeps same-named tenant products distinct and combines sizes of the same product', () => {
  expect(
    buildTopProducts([
      row(1),
      { ...row(1), _id: 'size' },
      { ...row(2), productName: row(1).productName },
    ]),
  ).toHaveLength(2);
});
it('invalid quantities cannot poison units and nonpositive quantities are out of stock without flags', () => {
  expect(sumUnits([row(1), row(2, NaN), row(3, -2)])).toBe(0);
  expect(countOutOfStock([row(1), row(2, 0), row(3, -2)])).toBe(2);
});
import { computeCounts, buildWarehouseSlices } from './inventory-dashboard-data';
import type { InventoryMovement } from '@/services/inventory.service';
it('operation counts include both transfer legs and count multi-line transfers once', () => {
  const moves = ['transfer_out', 'transfer_in', 'transfer_out', 'transfer_in'].map(
    (type, i) =>
      ({
        _id: String(i),
        type,
        category: 'transfer',
        status: 'confirmed',
        reference: 'Transfer ST1',
      }) as InventoryMovement,
  );
  expect(computeCounts(moves)).toMatchObject({ transfers: 1, internalLegs: 4, receipts: 0 });
});
it('warehouse chart values include negative and zero balances without rounding away cents', () => {
  expect(buildWarehouseSlices([row(1, -3), row(2, 0)])[0].value).toBe(-6.75);
});
import { stockCSV } from './inventory-dashboard-export';
it('stock export preserves matching zero and negative quantities and escapes product labels', () => {
  const csv = stockCSV([
    { ...row(1, 0), productName: 'Wine, "Red"', sku: 'W1', sizeName: '75cl' },
    { ...row(2, -3), productName: '=unsafe', sku: 'W2', sizeName: '75cl' },
  ]);
  expect(csv).toContain('"Wine, ""Red"""');
  expect(csv).toContain('"\'=unsafe"');
  expect(csv).toContain('"-3"');
  expect(csv).toContain('"-6.75"');
});
