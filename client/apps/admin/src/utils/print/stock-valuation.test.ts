import { expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import { lineValue, sortStockRows } from '@/app/shared/inventory/inventory-stock-search';
import { stockViewTotals, stockViewCSV } from '@/app/shared/inventory/inventory-stock-view';
import { buildStockDoc } from './stock-print';
const rows = [
  {
    productName: 'Wine',
    warehouseName: 'Wyn City',
    currentQuantity: 20,
    reservedQuantity: 5,
    costPrice: 100,
    stockValue: 3500,
    valuationUnitCost: 175,
    valuationMethod: 'fifo',
    estimatedQuantity: 0,
    valuationSource: 'batches',
  },
  { productName: 'Beer', currentQuantity: -2, costPrice: 80, stockValue: -160 },
] as StockRow[];
it('screen and totals honor captured carrying value rather than next-issue cost', () => {
  expect(lineValue(rows[0])).toBe(3500);
  expect(stockViewTotals(rows).value).toBe(3340);
  expect(lineValue({ ...rows[0], stockValue: NaN })).toBe(2000);
});
it('CSV and PDF contain the carrying unit cost, method and available quantity and finite totals', () => {
  expect(stockViewCSV(rows)).toContain('175');
  const doc = buildStockDoc(
    [...rows, { currentQuantity: NaN, reservedQuantity: Infinity } as StockRow],
    'Valuation',
    true,
  );
  expect(doc.table.columns.map((c) => c.label)).toContain('Method');
  expect(doc.table.columns.map((c) => c.label)).toContain('Available');
  expect(JSON.stringify(doc)).toContain('175');
  expect(JSON.stringify(doc)).not.toMatch(/NaN|Infinity/);
  expect(doc.totals.find((t) => t.label === 'Stock value')?.value).toContain('3,340');
});

it('valuation cost sorting follows the displayed carrying cost while stock cost sorting keeps issue cost', () => {
  const other = { ...rows[0], _id: 'other', productName: 'Other', costPrice: 150, valuationUnitCost: 120 };
  expect(sortStockRows([rows[0], other], 'cost', 'asc', undefined, true)[0].productName).toBe('Other');
  expect(sortStockRows([rows[0], other], 'cost', 'asc')[0].productName).toBe('Wine');
});
