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
import { sizeLabel } from './inventory-receipts-support';
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

// ── Retail variant identity (DRI-30) ─────────────────────────────────────────
//
// Movement labels compose the full shared label additively. The server populate
// (DRI-29, `inventoryService.getMovements`) already ships the identity fields
// emit-only-with-identity, so these activate on real payloads; legacy rows must
// stay byte-identical.
it('composes variant identity from a populated retail Size ref (DRI-29 payload shape)', () => {
  // The additive identity keys arrive on the wire (DRI-29); the client
  // InventoryMovement interface is a DRI-27-held file, so the test casts the
  // populated ref — the runtime compose consumes it via populatedSizeIdentity.
  const retailSize = {
    _id: 'sz-em',
    displayName: 'M',
    colorName: 'Emerald',
    colorHexCode: '#10b981',
  } as unknown as InventoryMovement['size'];
  const optionSize = {
    _id: 's',
    size: 'M',
    optionName: 'Wi-Fi',
  } as unknown as InventoryMovement['size'];
  expect(sizeLabel(move({ size: retailSize }))).toBe('M · Emerald');
  expect(sizeLabel(move({ size: optionSize }))).toBe('M · Wi-Fi');
});
it('keeps legacy movement size labels byte-identical (fallback chain unchanged)', () => {
  // Populated Size without identity, no snapshot: displayName/size chain.
  expect(sizeLabel(move())).toBe('75cl');
  // sizeName snapshot precedence preserved.
  expect(sizeLabel(move({ sizeName: '70cl' }))).toBe('70cl');
  // Same-size sibling without identity stays unambiguous to the snapshot.
  expect(sizeLabel(move({ sizeName: 'M', size: { _id: 'sz-iv', size: 'M' } }))).toBe('M');
  // Sizeless movement renders nothing.
  expect(sizeLabel(move({ sizeName: undefined, size: null }))).toBeNull();
});
it('history scope label composes the full variant label for retail rows and pins legacy bytes', () => {
  const retailRow = {
    ...row,
    sizeId: 'sz-em',
    sizeName: 'M',
    colorName: 'Emerald',
  } as StockRow;
  const retailDoc = buildStockHistoryDocument(retailRow, [], 'line');
  expect(retailDoc.meta).toContainEqual(['Scope', 'Wyn City · M · Emerald']);
  const legacyDoc = buildStockHistoryDocument(row, [], 'line');
  expect(legacyDoc.meta).toContainEqual(['Scope', 'Wyn City · 75cl']);
});
