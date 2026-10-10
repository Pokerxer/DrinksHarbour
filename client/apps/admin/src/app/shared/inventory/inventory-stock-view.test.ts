import { expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import {
  toggleStockPage,
  visibleStockSelection,
  stockViewTotals,
  stockViewCSV,
} from './inventory-stock-view';
import { restoreStockView } from './inventory-stock-saved-view';
const rows = [
  {
    _id: 'a',
    subProductId: 'one',
    warehouseId: 'w1',
    currentQuantity: 4,
    reservedQuantity: 1,
    costPrice: 2,
    sellingPrice: 1,
    productName: 'Wine, "Red"',
  },
  {
    _id: 'b',
    subProductId: 'two',
    warehouseId: 'w2',
    currentQuantity: -2,
    reservedQuantity: 0,
    costPrice: 3,
    sellingPrice: 4,
    productName: '=Beer',
  },
] as StockRow[];
it('toggling a page preserves other pages and deselects only that page', () => {
  expect(Array.from(toggleStockPage(new Set(['a']), [rows[1]]))).toEqual(['a', 'b']);
  expect(Array.from(toggleStockPage(new Set(['a', 'b']), [rows[1]]))).toEqual(['a']);
});
it('filtered selection never prints hidden rows', () => {
  expect(visibleStockSelection(rows.slice(0, 1), new Set(['a', 'b'])).map((r) => r._id)).toEqual([
    'a',
  ]);
});
it('totals retain signed stock and negative profit across all matching lines', () => {
  expect(stockViewTotals(rows)).toMatchObject({
    units: 2,
    reserved: 1,
    available: 1,
    value: 2,
    retail: -4,
    profit: -6,
    products: 2,
  });
});
it('CSV includes available stock and escapes quotes and text formulas', () => {
  const csv = stockViewCSV(rows);
  expect(csv).toContain('"Wine, ""Red"""');
  expect(csv).toContain('"\'=Beer"');
  expect(csv).toContain('Available');
  expect(csv).toContain('"-2"');
});
it('saved views restore exact products, expiry bounds and sort, with old-view defaults', () => {
  const view = restoreStockView({
    productIds: ['one', 'two'],
    expiryFrom: '2026-10-01',
    expiryTo: '2026-10-31',
    sortCol: 'value',
    sortDir: 'desc',
  });
  expect(view).toMatchObject({
    productIds: ['one', 'two'],
    expiryFrom: '2026-10-01',
    expiryTo: '2026-10-31',
    sortCol: 'value',
    sortDir: 'desc',
  });
  expect(restoreStockView({})).toMatchObject({
    productIds: [],
    expiryFrom: '',
    expiryTo: '',
    sortCol: 'product',
    sortDir: 'asc',
  });
});
