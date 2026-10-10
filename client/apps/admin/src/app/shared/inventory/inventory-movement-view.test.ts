import { expect, it } from 'vitest';
import { referenceLabel } from './inventory-receipts-support';
import type { InventoryMovement } from '@/services/inventory.service';
import {
  movementStats,
  matchesMovement,
  movementBounds,
  toggleMovementPage,
} from './inventory-movement-view';
const move = (changes: Partial<InventoryMovement> = {}) =>
  ({
    _id: 'a',
    type: 'transfer_in',
    category: 'transfer',
    status: 'confirmed',
    quantity: 5,
    createdAt: '2026-10-04T12:00:00Z',
    warehouse: { _id: 'dest', name: 'City' },
    sourceWarehouse: { _id: 'src', name: 'Depot' },
    destinationWarehouse: { _id: 'dest', name: 'City' },
    subProduct: { _id: 'p', sku: 'ABC', product: { name: 'Château Wine' } },
    totalCost: 50,
    ...changes,
  }) as InventoryMovement;
it('counts posted legs and returns, excluding reservations and pending entries', () => {
  const stats = movementStats([
    move(),
    move({ type: 'return_out', category: 'out', quantity: 2, totalCost: 20 }),
    move({ status: 'pending', quantity: 100 }),
    move({ type: 'reserved', quantity: 20 }),
    move({
      subProduct: {
        _id: 'other',
        product: { name: 'Château Wine' },
      } as InventoryMovement['subProduct'],
      type: 'transfer_out',
      quantity: 3,
      totalCost: 30,
    }),
  ]);
  expect(stats).toMatchObject({
    count: 5,
    units: 10,
    incoming: 5,
    outgoing: 5,
    net: 0,
    cost: 100,
    products: 2,
    warehouses: 2,
  });
});
it('matches accent-insensitive alternatives, SKU, multiple IDs and actual warehouse leg', () => {
  expect(
    matchesMovement(move(), {
      search: 'missing, chateau wine',
      products: 'p,other',
      warehouse: 'dest',
    }),
  ).toBe(true);
  expect(matchesMovement(move(), { search: 'abc', warehouse: 'src' })).toBe(false);
  expect(matchesMovement(move({ warehouse: undefined }), { warehouse: 'src' })).toBe(true);
  expect(matchesMovement(move(), { products: 'other' })).toBe(false);
});
it('includes the last millisecond of a minute and rejects reversed bounds', () => {
  const bounds = movementBounds('2026-10-04', '2026-10-04', '10:00', '10:00');
  expect(bounds.end! - bounds.start!).toBe(59999);
  expect(movementBounds('2026-10-05', '2026-10-04', '00:00', '23:59').error).toBeTruthy();
});
it('preserves selected rows on other pages', () => {
  expect(Array.from(toggleMovementPage(new Set(['old']), [move()], false))).toEqual(['old', 'a']);
  expect(Array.from(toggleMovementPage(new Set(['old', 'a']), [move()], true))).toEqual(['old']);
});
it('searches the original goods receipt reference and lot even when a purchase number is shown', () => {
  const receipt = move({
    type: 'received',
    category: 'in',
    reference: 'GRN-17',
    relatedPurchaseOrder: { _id: 'po', poNumber: 'PO-41' },
    lotNumber: 'LOT-92',
    source: 'api',
  });
  expect(matchesMovement(receipt, { search: 'grn-17' })).toBe(true);
  expect(matchesMovement(receipt, { search: 'lot-92' })).toBe(true);
});
it('shows linked sales references when shipments have no manually recorded reference', () => {
  const delivery = move({
    type: 'shipped',
    relatedOrder: { _id: 'order', orderNumber: 'ORDER-7', receiptNumber: 'SALE-8' },
  });
  expect(referenceLabel(delivery)).toBe('SALE-8');
  expect(referenceLabel({ ...delivery, reference: 'DL-1' })).toBe('DL-1');
  expect(matchesMovement(delivery, { search: 'ORDER-7' })).toBe(true);
});
