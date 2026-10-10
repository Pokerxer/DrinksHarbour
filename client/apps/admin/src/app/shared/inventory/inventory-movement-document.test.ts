import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { buildMovementDocument, movementDocumentLink } from './inventory-movement-document';
const move = (extra: Partial<InventoryMovement> = {}) =>
  ({
    _id: 'm',
    subProduct: { _id: 'p', name: 'Wine' },
    quantity: 3,
    type: 'received',
    category: 'in',
    status: 'confirmed',
    warehouse: { _id: 'w', name: 'Wyn City' },
    size: { _id: 's', displayName: '75cl' },
    createdAt: '2026-10-04T10:00:00Z',
    reference: 'PO-1',
    quantityBefore: 1,
    quantityAfter: 4,
    ...extra,
  }) as InventoryMovement;
it('prints recorded movement cost, actor, size and balances without inventing tax', () => {
  const doc = buildMovementDocument(
    move({
      unitCost: 100,
      totalCost: 250,
      performedBy: { _id: 'u', firstName: 'Ada', lastName: 'Okafor' },
    }),
    'Stock receipt',
  );
  expect(doc.table.rows[0].map((cell) => cell.text).join(' ')).toContain('250');
  expect(doc.table.rows[0][0].sub).toContain('75cl');
  expect(doc.meta).toContainEqual(['Recorded by', 'Ada Okafor']);
  expect(doc.meta).toContainEqual(['Stock balance', '1 → 4']);
  expect(doc.totals.some((total) => /tax/i.test(total.label))).toBe(false);
});
it('unknown costs remain unavailable and pending records do not claim a posted balance', () => {
  const doc = buildMovementDocument(move({ status: 'pending' }), 'Stock receipt');
  expect(doc.table.rows[0].slice(-2).map((cell) => cell.text)).toEqual(['—', '—']);
  expect(doc.meta).toContainEqual(['Stock balance', 'Not posted']);
  expect(doc.watermark).toBe('PENDING');
});
it('links authoritative related IDs only, leaving manual references unlinked', () => {
  expect(movementDocumentLink(move({ relatedPurchaseOrder: 'po-id' }))?.href).toBe(
    '/purchases/po-id',
  );
  expect(
    movementDocumentLink(move({ relatedOrder: { _id: 'order-id', receiptNumber: 'INV-1' } }))?.href,
  ).toBe('/ecommerce/orders/order-id');
  expect(movementDocumentLink(move())).toBeNull();
});
it('prints the source, SKU, batches and both dates without losing recorded notes', () => {
  const doc = buildMovementDocument(
    move({
      source: 'system',
      reference: 'bulk-import',
      subProduct: { _id: 'p', name: 'Wine', sku: 'WINE-X' } as InventoryMovement['subProduct'],
      batchNumber: 'B-1',
      lotNumber: 'L-1',
      notes: 'Opening stock import',
      performedAt: '2026-10-03T10:00:00Z',
    }),
    'Stock movement',
  );
  expect(doc.meta).toContainEqual(['Source', 'system']);
  expect(doc.meta).toContainEqual(['SKU', 'WINE-X']);
  expect(doc.meta).toContainEqual(['Batch', 'B-1']);
  expect(doc.meta.some(([key]) => key === 'Performed date')).toBe(true);
  expect(doc.sections).toContainEqual({ title: 'Notes', body: 'Opening stock import' });
});
it('retains the movement reference separately from a linked purchase number', () => {
  const doc = buildMovementDocument(
    move({ reference: 'TRANSFER-7', relatedPurchaseOrder: { _id: 'po', poNumber: 'PO-4' } }),
    'Stock movement',
  );
  expect(doc.meta).toContainEqual(['Reference', 'TRANSFER-7']);
  expect(doc.meta).toContainEqual(['Purchase order', 'PO-4']);
});
