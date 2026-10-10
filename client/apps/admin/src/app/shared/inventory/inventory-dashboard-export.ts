import type { StockRow } from '@/services/warehouseStock.service';
import { finite, stockHealth } from './inventory-dashboard-analysis';
export function stockCSV(rows: StockRow[]) {
  const cell = (value: string | number) => {
    const text = typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    [
      'Product',
      'SKU',
      'Size',
      'Warehouse',
      'On hand',
      'Reserved',
      'Unit cost',
      'Unit retail',
      'Stock value (NGN)',
      'Retail value (NGN)',
      'Stock health',
    ],
    ...rows.map((row) => [
      row.productName,
      row.sku,
      row.sizeName,
      row.warehouseName,
      finite(row.currentQuantity),
      finite(row.reservedQuantity),
      finite(row.costPrice),
      finite(row.sellingPrice),
      finite(row.currentQuantity) * finite(row.costPrice),
      finite(row.currentQuantity) * finite(row.sellingPrice),
      stockHealth(row),
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\n');
}
export function exportStock(rows: StockRow[]) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', stockCSV(rows)], { type: 'text/csv;charset=utf-8;' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `inventory-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
