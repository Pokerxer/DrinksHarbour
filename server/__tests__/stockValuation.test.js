const test = require('node:test');
const assert = require('node:assert/strict');
const { stockValuation } = require('../services/stockValuation');
const lots = [
  { quantity: 5, unitCost: 100, receivedDate: '2026-01-01' },
  { quantity: 15, unitCost: 200, receivedDate: '2026-02-01' },
];
test('FIFO values remaining layers rather than applying the oldest issue cost to every unit', () => {
  assert.deepEqual(stockValuation(lots, 'fifo', 20, 80), {
    stockValue: 3500,
    valuationUnitCost: 175,
    valuationSource: 'batches',
    estimatedQuantity: 0,
    unpricedQuantity: 0,
    batchQuantityMismatch: false,
  });
  assert.equal(stockValuation(lots, 'fifo', 10, 80).stockValue, 1500);
  assert.equal(stockValuation(lots, 'fifo', 10, 80).batchQuantityMismatch, true);
});
test('average includes unpriced lots at standard cost and uncovered stock is explicitly estimated', () => {
  const result = stockValuation(
    [{ quantity: 5, unitCost: 100 }, { quantity: 5 }],
    'average',
    10,
    80,
  );
  assert.equal(result.stockValue, 900);
  assert.equal(result.estimatedQuantity, 5);
  assert.equal(result.valuationSource, 'mixed');
  assert.equal(stockValuation(lots, 'fifo', 25, 80).stockValue, 3900);
  assert.equal(stockValuation(lots, 'fifo', 25, 80).estimatedQuantity, 5);
});
test('keeps negative stock signed, zero stock zero and invalid inputs finite', () => {
  assert.equal(stockValuation(lots, 'fifo', -2, 80).stockValue, -160);
  assert.equal(stockValuation(lots, 'fifo', 0, 80).stockValue, 0);
  assert.equal(stockValuation([], 'fifo', NaN, Infinity).stockValue, 0);
  assert.equal(
    stockValuation([{ quantity: Infinity, unitCost: NaN }], 'fifo', 2, 80).stockValue,
    160,
  );
});
