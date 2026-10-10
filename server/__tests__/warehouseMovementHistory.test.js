const test = require('node:test');
const assert = require('node:assert/strict');
const { movementMetrics, summarizeMovements } = require('../services/warehouseMovementHistory');
test('recounts show their signed change rather than the absolute target', () => {
  assert.deepEqual(
    movementMetrics({ type: 'adjusted', quantity: 7, balanceBefore: 10, balanceAfter: 7 }),
    { stockChange: -3, balanceBefore: 10 },
  );
  assert.deepEqual(movementMetrics({ type: 'adjusted', quantity: 7, balanceAfter: 7 }), {
    stockChange: null,
    balanceBefore: null,
  });
});
test('ordinary movements and returns reconstruct before balance in their physical direction', () => {
  assert.deepEqual(movementMetrics({ type: 'transfer_out', quantity: 4, balanceAfter: 6 }), {
    stockChange: -4,
    balanceBefore: 10,
  });
  assert.deepEqual(movementMetrics({ type: 'returned', quantity: 3, balanceAfter: 9 }), {
    stockChange: 3,
    balanceBefore: 6,
  });
  assert.deepEqual(movementMetrics({ type: 'return_out', quantity: 2, balanceAfter: 7 }), {
    stockChange: -2,
    balanceBefore: 9,
  });
});
test('explicit actual stock delta takes precedence over requested quantity', () => {
  assert.deepEqual(
    movementMetrics({
      type: 'shipped',
      quantity: 20,
      balanceAfter: 0,
      balanceBefore: 5,
      stockChange: -5,
    }),
    { stockChange: -5, balanceBefore: 5 },
  );
});
test('summary sums known changes once and identifies unknown recounts', () => {
  const result = summarizeMovements([
    { type: 'received', quantity: 10, balanceAfter: 10 },
    { type: 'transfer_out', quantity: 4, balanceAfter: 6 },
    { type: 'returned', quantity: 2, balanceAfter: 8 },
    { type: 'adjusted', quantity: 5, balanceAfter: 5, balanceBefore: 8 },
    { type: 'adjusted', quantity: 5, balanceAfter: 5 },
  ]);
  assert.deepEqual(result, {
    incomingQuantity: 12,
    outgoingQuantity: 7,
    netQuantity: 5,
    records: 5,
    unknownChanges: 1,
  });
});
