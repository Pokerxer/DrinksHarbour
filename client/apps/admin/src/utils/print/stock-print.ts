import type { StockRow } from '@/services/warehouseStock.service';
import { lineValue, statusOf, STATUS_BADGE } from '@/app/shared/inventory/inventory-stock-search';
import type { DocumentModel } from './doc-model';
import { fmtAmt, fmtDate } from './print-shared';
export function buildStockDoc(
  rows: StockRow[],
  title: string,
  valuation: boolean,
  companyName = 'DrinksHarbour'
): DocumentModel {
  return {
    kind: 'stock',
    companyName,
    department: 'Inventory',
    docTitle: title,
    number: `STOCK-${new Date().toISOString().slice(0, 10)}`,
    parties: [],
    meta: [
      ['Generated', fmtDate(new Date().toISOString())],
      ['Lines', String(rows.length)],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Size' },
        { label: 'Warehouse' },
        { label: 'On hand', align: 'right' },
        { label: 'Reserved', align: 'right' },
        ...(valuation
          ? [
              { label: 'Unit cost', align: 'right' as const },
              { label: 'Value', align: 'right' as const },
            ]
          : [{ label: 'Status' }]),
      ],
      rows: rows.map((r) => [
        { text: r.productName, sub: r.sku },
        { text: r.sizeName },
        { text: r.warehouseName },
        { text: String(r.currentQuantity) },
        { text: String(r.reservedQuantity) },
        ...(valuation
          ? [{ text: fmtAmt(r.costPrice || 0, 'NGN') }, { text: fmtAmt(lineValue(r), 'NGN') }]
          : [{ text: STATUS_BADGE[statusOf(r)].label }]),
      ]),
    },
    totals: [
      {
        label: 'Total units',
        value: String(rows.reduce((sum, r) => sum + r.currentQuantity, 0)),
        variant: 'strong',
      },
      ...(valuation
        ? [
            {
              label: 'Stock value',
              value: fmtAmt(
                rows.reduce((sum, r) => sum + lineValue(r), 0),
                'NGN'
              ),
              variant: 'grand' as const,
            },
          ]
        : []),
    ],
    sections: [],
    signatures: [],
    fileName: `${title.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
  };
}
