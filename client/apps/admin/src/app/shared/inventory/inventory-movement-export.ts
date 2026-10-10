import type { InventoryMovement } from '@/services/inventory.service';
import type { DocumentModel } from '@/utils/print/doc-model';
import { requestDocumentExport } from '@/utils/print/document-export';
import {
  balanceLabel,
  changeLabel,
  historyDate,
  movementLabel,
  movementDelta,
  transferRoute,
} from './inventory-stock-history';
import {
  byLabel,
  fmtNgn,
  productLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';
import { refId } from './inventory-dashboard-analysis';
import { movementCost, movementStats } from './inventory-movement-view';
const costLabel = (move: InventoryMovement) => {
  const cost = movementCost(move);
  return cost === null ? '—' : fmtNgn(cost);
};
export function buildMovementsDocument(
  moves: InventoryMovement[],
  title: string,
  scope = 'All matching movement entries',
): DocumentModel {
  const stats = movementStats(moves);
  return {
    kind: 'stock',
    companyName: 'DrinksHarbour',
    department: 'Inventory',
    docTitle: title,
    number: `MOVES-${new Date().toISOString().slice(0, 10)}`,
    parties: [],
    meta: [
      ['Scope', scope],
      ['Entries', String(moves.length)],
      ['Dates', 'Recorded date · ' + Intl.DateTimeFormat().resolvedOptions().timeZone],
    ],
    table: {
      columns: [
        { label: 'Recorded / Product' },
        { label: 'Movement / Status' },
        { label: 'Warehouse / Size' },
        { label: 'Reference / By' },
        { label: 'Posted change', align: 'right' },
        { label: 'Balance / Cost', align: 'right' },
      ],
      rows: moves.map((move) => [
        {
          text: historyDate(move),
          sub: [productLabel(move), typeof move.subProduct === 'object' ? move.subProduct?.sku : '']
            .filter(Boolean)
            .join(' · '),
        },
        { text: movementLabel(move), sub: move.status },
        {
          text: warehouseLabel(move.warehouse),
          sub: [
            sizeLabel(move),
            transferRoute(move),
            move.batchNumber ? `Batch ${move.batchNumber}` : '',
            move.lotNumber ? `Lot ${move.lotNumber}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        },
        {
          text: referenceLabel(move),
          sub: [byLabel(move), move.source, move.supplierName, move.reason, move.notes]
            .filter(Boolean)
            .join(' · '),
        },
        {
          text: changeLabel(move),
          sub: `Recorded qty ${Number.isFinite(move.quantity) ? Math.abs(move.quantity) : '—'}`,
        },
        { text: balanceLabel(move), sub: costLabel(move) },
      ]),
    },
    totals: [
      { label: 'Posted in', value: String(stats.incoming) },
      { label: 'Posted out', value: String(stats.outgoing) },
      { label: 'Net posted change', value: String(stats.net), variant: 'strong' },
      { label: 'Posted movement cost', value: fmtNgn(stats.cost) },
    ],
    sections: [
      {
        title: 'Movement totals',
        body: `Only confirmed on-hand changes count toward totals. Reservations, releases and pending entries do not change stock. Each warehouse leg is counted separately. ${stats.unpriced ? `${stats.unpriced} posted entries have no recorded cost and are excluded from the cost total.` : ''}`,
      },
    ],
    signatures: [],
    fileName: 'inventory-moves.pdf',
  };
}
export const printMovementHistory = (moves: InventoryMovement[], title: string, scope?: string) =>
  requestDocumentExport(buildMovementsDocument(moves, title, scope));
export function movementsCSV(moves: InventoryMovement[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [
    [
      'Recorded date',
      'Product',
      'Size',
      'Movement',
      'Status',
      'Warehouse',
      'Route',
      'Reference',
      'Recorded quantity',
      'Posted change',
      'Balance',
      'Recorded cost',
      'By',
      'Reason',
      'Supplier',
      'SKU',
      'Unit cost',
      'Batch',
      'Lot',
      'Expiry',
      'Notes',
      'Original reference',
      'Source',
      'Sales order',
      'Sales receipt',
      'From warehouse',
      'To warehouse',
      'From warehouse ID',
      'To warehouse ID',
    ],
    ...moves.map((move) => [
      move.createdAt,
      productLabel(move),
      sizeLabel(move),
      movementLabel(move),
      move.status,
      warehouseLabel(move.warehouse),
      transferRoute(move),
      referenceLabel(move),
      Number.isFinite(move.quantity) ? move.quantity : null,
      movementDelta(move),
      balanceLabel(move),
      movementCost(move),
      byLabel(move),
      move.reason || move.notes,
      move.supplierName,
      typeof move.subProduct === 'object' ? move.subProduct?.sku : '',
      Number.isFinite(move.unitCost) ? move.unitCost : null,
      move.batchNumber,
      move.lotNumber,
      move.expirationDate,
      move.notes,
      move.reference,
      move.source,
      typeof move.relatedOrder === 'object' ? move.relatedOrder?.orderNumber : '',
      typeof move.relatedOrder === 'object' ? move.relatedOrder?.receiptNumber : '',
      warehouseLabel(move.sourceWarehouse),
      warehouseLabel(move.destinationWarehouse),
      refId(move.sourceWarehouse),
      refId(move.destinationWarehouse),
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
export function exportMovementCSV(moves: InventoryMovement[], prefix: string) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + movementsCSV(moves)], { type: 'text/csv;charset=utf-8;' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
