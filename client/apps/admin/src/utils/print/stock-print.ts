import type { StockRow } from '@/services/warehouseStock.service';
import {
  lineValue,
  carryingCostOf,
  availableOf,
  statusOf,
  STATUS_BADGE,
} from '@/app/shared/inventory/inventory-stock-search';
import { finite } from '@/app/shared/inventory/inventory-dashboard-analysis';
import { stockViewTotals } from '@/app/shared/inventory/inventory-stock-view';
import type { DocumentModel } from './doc-model';
import { fmtAmt, fmtDate } from './print-shared';
export function buildStockDoc(
  rows: StockRow[],
  title: string,
  valuation: boolean,
  companyName = 'DrinksHarbour',
): DocumentModel {
  const totals = stockViewTotals(rows);
  const estimated = rows.filter((row) => finite(row.estimatedQuantity) > 0).length;
  const unpriced = rows.filter((row) => finite(row.unpricedQuantity) > 0).length;
  const mismatch = rows.filter((row) => row.batchQuantityMismatch).length;
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
      ...(valuation
        ? [['Basis', 'On-hand stock, including reserved units'] as [string, string]]
        : []),
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
              { label: 'Available', align: 'right' as const },
              { label: 'Method' },
              { label: 'Carrying unit cost', align: 'right' as const },
              { label: 'Value', align: 'right' as const },
            ]
          : [{ label: 'Status' }]),
      ],
      rows: rows.map((r) => [
        { text: r.productName || '—', sub: r.sku },
        { text: r.sizeName || '—' },
        { text: r.warehouseName || '—' },
        { text: String(finite(r.currentQuantity)) },
        { text: String(finite(r.reservedQuantity)) },
        ...(valuation
          ? [
              { text: String(availableOf(r)) },
              {
                text: (r.valuationMethod || 'standard').toUpperCase(),
                sub: [
                  r.valuationSource,
                  finite(r.estimatedQuantity) > 0 ? `${r.estimatedQuantity} estimated units` : '',
                  r.batchQuantityMismatch ? 'Batch quantities differ' : '',
                  finite(r.unpricedQuantity) > 0 ? `${r.unpricedQuantity} units without cost` : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              },
              { text: fmtAmt(carryingCostOf(r), 'NGN') },
              { text: fmtAmt(lineValue(r), 'NGN') },
            ]
          : [{ text: STATUS_BADGE[statusOf(r)].label }]),
      ]),
    },
    totals: [
      { label: 'Total units', value: String(totals.units), variant: 'strong' },
      ...(valuation
        ? [
            { label: 'Reserved units', value: String(totals.reserved) },
            { label: 'Available units', value: String(totals.available) },
            { label: 'Stock value', value: fmtAmt(totals.value, 'NGN'), variant: 'grand' as const },
          ]
        : []),
    ],
    sections: valuation
      ? [
          {
            title: 'Valuation basis',
            body: 'Value includes all on-hand units, including reserved stock. FIFO uses remaining cost layers; average uses quantity-weighted batch costs. Uncovered or unpriced units use the saved standard cost where available. Negative stock uses a signed standard-cost estimate. Carrying unit cost is value divided by on-hand quantity; it can differ from the next FIFO issue cost.',
          },
          ...(estimated || unpriced || mismatch
            ? [
                {
                  title: 'Valuation checks',
                  body: `${estimated} lines include estimates; ${unpriced} lines have units without a known cost; ${mismatch} lines have batch quantities that differ from on-hand. Review those lines before relying on the total.`,
                },
              ]
            : []),
        ]
      : [],
    signatures: [],
    fileName: `${title.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
  };
}
