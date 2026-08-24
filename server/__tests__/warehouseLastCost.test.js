// __tests__/warehouseLastCost.test.js
// Pure resolution order for the "last cost price" shown when buying or
// transferring stock from a warehouse: receipt movement → batch landed cost →
// configured standard cost. The controller gathers candidates; this file pins
// the decision logic.
const test = require('node:test');
const assert = require('node:assert');

const { resolveLastCost } = require('../services/warehouse.service');

const DAY = 86_400_000;
const NOW = new Date();

test('a receipt movement with unitCost wins when it is the newest signal', () => {
  const r = resolveLastCost({
    movementCost: 1500,
    movementDate: new Date(NOW.getTime() - DAY),
    batch: { unitCost: 1200, receivedDate: new Date(NOW.getTime() - 10 * DAY) },
    standardCost: 1000,
  });
  assert.strictEqual(r.unitCost, 1500);
  assert.strictEqual(r.source, 'movement');
});

test('an older receipt defers to a newer batch landed cost', () => {
  const r = resolveLastCost({
    movementCost: 900,
    movementDate: new Date(NOW.getTime() - 30 * DAY),
    batch: { unitCost: 1200, receivedDate: new Date(NOW.getTime() - 2 * DAY), poNumber: 'PO-7' },
    standardCost: 1000,
  });
  assert.strictEqual(r.unitCost, 1200);
  assert.strictEqual(r.source, 'batch');
  assert.strictEqual(r.reference, 'PO-7');
});

test('batch without cost falls through to standard cost', () => {
  const r = resolveLastCost({
    movementCost: null,
    movementDate: null,
    batch: { unitCost: 0, receivedDate: new Date() },
    standardCost: 800,
  });
  assert.strictEqual(r.unitCost, 800);
  assert.strictEqual(r.source, 'standard');
});

test('size-level standard cost is passed straight through by the caller', () => {
  // The controller resolves size.costPrice ?? subProduct.costPrice before
  // calling; the resolver treats any positive standardCost identically.
  const r = resolveLastCost({
    movementCost: undefined,
    movementDate: undefined,
    batch: null,
    standardCost: 425.5,
  });
  assert.strictEqual(r.unitCost, 425.5);
  assert.strictEqual(r.source, 'standard');
  assert.strictEqual(r.asOf, null);
});

test('no signals at all → none (UI hides the cost line)', () => {
  const r = resolveLastCost({});
  assert.strictEqual(r.unitCost, null);
  assert.strictEqual(r.source, 'none');
});
