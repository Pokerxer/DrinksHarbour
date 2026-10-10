import type { InventoryMovement } from '@/services/inventory.service';
import type { StockRow } from '@/services/warehouseStock.service';
import type { DocumentModel } from '@/utils/print/doc-model';
import { finite, refId, isTransferReturn } from './inventory-dashboard-analysis';
import {
  TYPE_LABEL,
  byLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';
export type HistoryScope = 'line' | 'product';
export function filterStockHistory(moves: InventoryMovement[], row: StockRow, scope: HistoryScope) {
  return moves.filter(
    (move) =>
      refId(move.subProduct) === row.subProductId &&
      (scope === 'product' ||
        (refId(move.warehouse) === row.warehouseId && refId(move.size) === row.sizeId)),
  );
}
const incoming = new Set(['received', 'purchase', 'return', 'adjustment_in', 'transfer_in']);
const outgoing = new Set([
  'sold',
  'shipped',
  'return_out',
  'adjustment_out',
  'transfer_out',
  'damaged',
  'expired',
  'theft',
  'written_off',
]);
export function movementDelta(move: InventoryMovement): number | null {
  if (move.status !== 'confirmed' || ['reserved', 'released'].includes(move.type)) return 0;
  if (
    typeof move.quantityBefore === 'number' &&
    Number.isFinite(move.quantityBefore) &&
    typeof move.quantityAfter === 'number' &&
    Number.isFinite(move.quantityAfter)
  )
    return move.quantityAfter - move.quantityBefore;
  if (incoming.has(move.type)) return Math.abs(finite(move.quantity));
  if (outgoing.has(move.type)) return -Math.abs(finite(move.quantity));
  return null;
}
export function historyTotals(moves: InventoryMovement[]) {
  return moves.reduce(
    (total, move) => {
      const delta = movementDelta(move) ?? 0;
      if (delta > 0) total.incoming += delta;
      if (delta < 0) total.outgoing -= delta;
      total.net += delta;
      return total;
    },
    { incoming: 0, outgoing: 0, net: 0 },
  );
}
export function movementLabel(move: InventoryMovement) {
  if (isTransferReturn(move))
    return move.type.endsWith('_out') ? 'Transfer return out' : 'Transfer return in';
  return move.type === 'return_out'
    ? 'Return out'
    : TYPE_LABEL[move.type] || move.type.replace(/_/g, ' ');
}
export function changeLabel(move: InventoryMovement) {
  const delta = movementDelta(move);
  return delta === null ? 'Unknown' : delta > 0 ? `+${delta}` : String(delta);
}
export function balanceLabel(move: InventoryMovement) {
  if (move.status !== 'confirmed') return 'Not posted';
  const balance = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
  return `${balance(move.quantityBefore)} → ${balance(move.quantityAfter)}`;
}
export function historyDate(move: InventoryMovement) {
  const value = new Date(move.createdAt);
  return Number.isFinite(value.getTime()) ? value.toLocaleString('en-GB') : '—';
}
export function transferRoute(move: InventoryMovement) {
  return refId(move.sourceWarehouse) && refId(move.destinationWarehouse)
    ? `${warehouseLabel(move.sourceWarehouse)} → ${warehouseLabel(move.destinationWarehouse)}`
    : '';
}
export function buildStockHistoryDocument(
  row: StockRow,
  moves: InventoryMovement[],
  scope: HistoryScope,
  range = '',
): DocumentModel {
  const totals = historyTotals(moves);
  return {
    kind: 'stock',
    companyName: 'DrinksHarbour',
    department: 'Inventory',
    docTitle: 'Product movement history',
    number: `HISTORY-${new Date().toISOString().slice(0, 10)}`,
    parties: [],
    meta: [
      ['Product', row.productName],
      ['SKU', row.sku || '—'],
      [
        'Scope',
        scope === 'line' ? `${row.warehouseName} · ${row.sizeName}` : 'All warehouses and sizes',
      ],
      ['Date range', range || 'All dates'],
      ['Entries', String(moves.length)],
      ['Times', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ],
    table: {
      columns: [
        { label: 'Date' },
        { label: 'Movement / Status' },
        { label: 'Warehouse / Size' },
        { label: 'Reference / By' },
        { label: 'Change', align: 'right' },
        { label: 'Balance', align: 'right' },
      ],
      rows: moves.map((move) => [
        { text: historyDate(move) },
        { text: movementLabel(move), sub: move.status },
        {
          text: warehouseLabel(move.warehouse),
          sub: [sizeLabel(move) || 'No size recorded', transferRoute(move)]
            .filter(Boolean)
            .join(' · '),
        },
        {
          text: referenceLabel(move),
          sub: [byLabel(move), move.reason || move.notes].filter(Boolean).join(' · '),
        },
        {
          text: changeLabel(move),
          sub:
            move.status !== 'confirmed' || ['reserved', 'released'].includes(move.type)
              ? `Recorded qty ${Math.abs(finite(move.quantity))}`
              : undefined,
        },
        { text: balanceLabel(move) },
      ]),
    },
    totals: [
      { label: 'Posted in', value: String(totals.incoming) },
      { label: 'Posted out', value: String(totals.outgoing) },
      { label: 'Net posted change', value: String(totals.net), variant: 'strong' },
    ],
    sections: [
      {
        title: 'History scope',
        body: 'Only confirmed changes affect posted totals. Reservations and releases do not change on-hand. Historical changes are not the current stock balance.',
      },
    ],
    signatures: [],
    fileName: `product-history-${(row.sku || row.subProductId).replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
  };
}
