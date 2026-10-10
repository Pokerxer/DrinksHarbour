import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import type { StockRow } from '@/services/warehouseStock.service';
import {
  filterStockHistory,
  movementDelta,
  movementLabel,
  historyTotals,
  buildStockHistoryDocument,
} from './inventory-stock-history';
const row = {
  subProductId: 'p',
  productName: 'Wine',
  sku: 'W',
  sizeId: 's',
  sizeName: '75cl',
  warehouseId: 'w',
  warehouseName: 'Wyn City',
  currentQuantity: 4,
} as StockRow;
const move = (over: Partial<InventoryMovement> = {}) =>
  ({
    _id: 'a',
    subProduct: 'p',
    warehouse: { _id: 'w', name: 'Wyn City' },
    size: { _id: 's', size: '75cl' },
    type: 'received',
    category: 'in',
    status: 'confirmed',
    quantity: 5,
    quantityBefore: 0,
    quantityAfter: 5,
    createdAt: '2026-10-04T10:00:00Z',
    ...over,
  }) as InventoryMovement;
it('history defaults to the exact warehouse and size while all-product view includes legacy unattributed moves', () => {
  const moves = [
    move(),
    move({ _id: 'other', warehouse: 'other', sourceWarehouse: 'w', destinationWarehouse: 'other' }),
    move({ _id: 'otherSize', size: { _id: 'other' } }),
    move({ _id: 'legacy', warehouse: null, size: null }),
    move({ _id: 'otherProduct', subProduct: 'other' }),
  ];
  expect(filterStockHistory(moves, row, 'line').map((m) => m._id)).toEqual(['a']);
  expect(filterStockHistory(moves, row, 'product')).toHaveLength(4);
});
it('posted totals exclude pending and reservations and reverse transfer return directions', () => {
  const moves = [
    move(),
    move({ type: 'return_out', category: 'out', quantity: 2, quantityBefore: 5, quantityAfter: 3 }),
    move({ type: 'reserved', quantityBefore: 3, quantityAfter: 1 }),
    move({ status: 'pending' }),
  ];
  expect(movementDelta(moves[1])).toBe(-2);
  expect(historyTotals(moves)).toEqual({ incoming: 5, outgoing: 2, net: 3 });
});
it('print includes every matching entry with product scope, actors and signed balances', () => {
  const moves = Array.from({ length: 35 }, (_, index) =>
    move({
      _id: String(index),
      reference: 'PO-1',
      performedBy: { _id: 'u', firstName: 'Ada', lastName: 'Obi' },
    }),
  );
  const doc = buildStockHistoryDocument(row, moves, 'line');
  expect(doc.table.rows).toHaveLength(35);
  expect(JSON.stringify(doc)).toContain('Ada Obi');
  expect(JSON.stringify(doc)).toContain('Wyn City');
  expect(JSON.stringify(doc)).toContain('+5');
  expect(doc.meta).toContainEqual(['Product', 'Wine']);
});
it('renders the complete product history as a real multi-page PDF', async () => {
  const { renderDocument } = await import('@/utils/print/pdf-render');
  const moves = Array.from({ length: 80 }, (_, index) =>
    move({ _id: String(index), reference: `PO-${index}` }),
  );
  const { default: jsPDF } = await import('jspdf');
  const pdf = renderDocument(
    buildStockHistoryDocument(row, moves, 'line'),
    new jsPDF({ unit: 'pt', format: 'a4', compress: false }),
  );
  expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
  const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
  expect(raw.startsWith('%PDF-')).toBe(true);
  expect(raw).toContain('PO-79');
});
it('labels the actual transfer-out return writer as a return out', () => {
  const move = {
    type: 'transfer_out',
    category: 'transfer',
    reference: 'Return of transfer TRF-1',
    sourceWarehouse: 'holding',
    destinationWarehouse: 'origin',
    status: 'confirmed',
    quantity: 2,
  } as InventoryMovement;
  expect(movementLabel(move)).toBe('Transfer return out');
});
