import type { StockRow } from '@/services/warehouseStock.service';
import { finite } from './inventory-dashboard-analysis';
import {
  availableOf,
  carryingCostOf,
  lineValue,
  lineRetail,
  statusOf,
  STATUS_BADGE,
} from './inventory-stock-search';

export function toggleStockPage(selected: Set<string>, rows: StockRow[]) {
  const next = new Set(selected);
  const remove = rows.length > 0 && rows.every((row) => next.has(row._id));
  rows.forEach((row) => (remove ? next.delete(row._id) : next.add(row._id)));
  return next;
}
export function visibleStockSelection(rows: StockRow[], selected: Set<string>) {
  return rows.filter((row) => selected.has(row._id));
}
export function stockViewTotals(rows: StockRow[]) {
  const units = rows.reduce((sum, row) => sum + finite(row.currentQuantity), 0);
  const reserved = rows.reduce((sum, row) => sum + finite(row.reservedQuantity), 0);
  const value = rows.reduce((sum, row) => sum + lineValue(row), 0);
  const retail = rows.reduce((sum, row) => sum + lineRetail(row), 0);
  return {
    count: rows.length,
    units,
    reserved,
    available: units - reserved,
    value,
    retail,
    profit: retail - value,
    products: new Set(rows.map((row) => row.subProductId)).size,
    warehouses: new Set(rows.map((row) => row.warehouseId).filter(Boolean)).size,
    alerts: rows.filter((row) => ['low', 'out', 'expiry'].includes(statusOf(row))).length,
  };
}
function cell(value: unknown) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function stockViewCSV(rows: StockRow[]) {
  const headers = [
    'Product',
    'SKU',
    'Size',
    'Warehouse',
    'On hand',
    'Reserved',
    'Available',
    'Category',
    'Unit Cost',
    'Wholesale Price',
    'Selling Price',
    'Value',
    'Method',
    'Status',
    'Earliest Expiry',
    'Carrying Unit Cost',
    'Cost Source',
    'Estimated Units',
    'Unpriced Units',
    'Batch Quantity Mismatch',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.productName,
        row.sku,
        row.sizeName,
        row.warehouseName,
        finite(row.currentQuantity),
        finite(row.reservedQuantity),
        availableOf(row),
        row.categoryName ?? 'Uncategorized',
        finite(row.costPrice),
        finite(row.wholesalePrice),
        finite(row.sellingPrice),
        lineValue(row),
        row.valuationMethod,
        STATUS_BADGE[statusOf(row)].label,
        row.earliestExpiry,
        carryingCostOf(row),
        row.valuationSource || 'standard',
        finite(row.estimatedQuantity),
        finite(row.unpricedQuantity),
        row.batchQuantityMismatch ? 'Yes' : 'No',
      ]
        .map(cell)
        .join(','),
    ),
  ].join('\n');
}
