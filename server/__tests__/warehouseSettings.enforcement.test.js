// __tests__/warehouseSettings.enforcement.test.js
// Unit coverage for the pure logic added when wiring server-side enforcement of
// tenant.warehouseSettings: reporting flags, valuation cost basis, and the
// FIFO / exclude-expired batch allocation paths.
const test = require('node:test');
const assert = require('node:assert');

const { computeStockFlags } = require('../services/warehouseStock.helpers');
const {
  allocateFefo,
  orderBatchesFifo,
  valuationCost,
  isExpired,
} = require('../services/batch.helpers');

const DAY = 86_400_000;
const SETTINGS = {
  lowStockThreshold: 10,
  reorderPoint: 5,
  flagBelowReorderPoint: true,
  overstockCeiling: 100,
  nearExpiryDays: 30,
  outOfStockAlert: true,
  reorderQuantity: 50,
};

test('computeStockFlags: out of stock', () => {
  const f = computeStockFlags({ currentQuantity: 0, reservedQuantity: 0 }, SETTINGS);
  assert.strictEqual(f.status, 'out_of_stock');
  assert.strictEqual(f.outOfStock, true);
  assert.strictEqual(f.outOfStockAlert, true);
});

test('computeStockFlags: low stock vs available, not below reorder', () => {
  const f = computeStockFlags({ currentQuantity: 8, reservedQuantity: 0 }, SETTINGS);
  assert.strictEqual(f.status, 'low_stock');
  assert.strictEqual(f.lowStock, true);
  assert.strictEqual(f.belowReorder, false); // 8 > reorderPoint 5
});

test('computeStockFlags: below reorder point uses available (current − reserved)', () => {
  const f = computeStockFlags({ currentQuantity: 8, reservedQuantity: 4 }, SETTINGS);
  assert.strictEqual(f.available, 4);
  assert.strictEqual(f.belowReorder, true); // 4 <= 5
});

test('computeStockFlags: per-line minStockLevel overrides global reorder point', () => {
  const f = computeStockFlags(
    { currentQuantity: 20, reservedQuantity: 0, minStockLevel: 25 },
    SETTINGS
  );
  assert.strictEqual(f.reorderPoint, 25);
  assert.strictEqual(f.belowReorder, true);
});

test('computeStockFlags: overstock ceiling', () => {
  const f = computeStockFlags({ currentQuantity: 150, reservedQuantity: 0 }, SETTINGS);
  assert.strictEqual(f.overstocked, true);
});

test('computeStockFlags: near-expiry window', () => {
  const soon = new Date(Date.now() + 10 * DAY).toISOString();
  const far = new Date(Date.now() + 90 * DAY).toISOString();
  assert.strictEqual(computeStockFlags({ currentQuantity: 50, earliestExpiry: soon }, SETTINGS).nearExpiry, true);
  assert.strictEqual(computeStockFlags({ currentQuantity: 50, earliestExpiry: far }, SETTINGS).nearExpiry, false);
});

test('isExpired: only past-dated lots count', () => {
  assert.strictEqual(isExpired({ expiryDate: new Date(Date.now() - DAY) }), true);
  assert.strictEqual(isExpired({ expiryDate: new Date(Date.now() + DAY) }), false);
  assert.strictEqual(isExpired({ expiryDate: null }), false);
});

function lots() {
  const now = Date.now();
  return [
    { _id: 'a', batchNumber: 'A', quantity: 5, expiryDate: new Date(now - DAY).toISOString(), receivedDate: new Date(now - 10 * DAY) },
    { _id: 'b', batchNumber: 'B', quantity: 5, expiryDate: new Date(now + 5 * DAY).toISOString(), receivedDate: new Date(now - 2 * DAY) },
    { _id: 'c', batchNumber: 'C', quantity: 5, expiryDate: new Date(now + 30 * DAY).toISOString(), receivedDate: new Date(now - 1 * DAY) },
  ];
}

test('allocateFefo: default FEFO draws soonest-expiry first (incl expired)', () => {
  const { allocations } = allocateFefo(lots(), 7);
  assert.deepStrictEqual(
    allocations.map((a) => `${a.batchNumber}:${a.quantity}`),
    ['A:5', 'B:2']
  );
});

test('allocateFefo: excludeExpired skips lapsed lots', () => {
  const { allocations } = allocateFefo(lots(), 7, { excludeExpired: true });
  assert.deepStrictEqual(
    allocations.map((a) => `${a.batchNumber}:${a.quantity}`),
    ['B:5', 'C:2']
  );
});

test('allocateFefo: FIFO orders by receivedDate', () => {
  const { allocations } = allocateFefo(lots(), 7, { order: 'fifo' });
  // oldest received is A (−10d), then B (−2d)
  assert.deepStrictEqual(
    allocations.map((a) => `${a.batchNumber}:${a.quantity}`),
    ['A:5', 'B:2']
  );
});

test('orderBatchesFifo: stable oldest-first ordering', () => {
  const ordered = orderBatchesFifo(lots()).map((b) => b.batchNumber);
  assert.deepStrictEqual(ordered, ['A', 'B', 'C']);
});

test('valuationCost: weighted average', () => {
  const ls = [
    { quantity: 10, unitCost: 100, receivedDate: '2026-01-01' },
    { quantity: 30, unitCost: 120, receivedDate: '2026-02-01' },
  ];
  assert.strictEqual(valuationCost(ls, 'average', 50), 115); // (1000+3600)/40
});

test('valuationCost: FIFO returns oldest lot cost', () => {
  const ls = [
    { quantity: 10, unitCost: 100, receivedDate: '2026-01-01' },
    { quantity: 30, unitCost: 120, receivedDate: '2026-02-01' },
  ];
  assert.strictEqual(valuationCost(ls, 'fifo', 50), 100);
});

test('valuationCost: standard / no-cost lots fall back', () => {
  assert.strictEqual(valuationCost([{ quantity: 5, unitCost: 0 }], 'average', 77), 77);
  assert.strictEqual(valuationCost([{ quantity: 5, unitCost: 9 }], 'standard', 77), 77);
  assert.strictEqual(valuationCost([], 'fifo', 42), 42);
});
