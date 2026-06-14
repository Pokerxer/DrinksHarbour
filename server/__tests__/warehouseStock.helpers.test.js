// server/__tests__/warehouseStock.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { computeRollup } = require('../services/warehouseStock.helpers');

test('computeRollup sums quantities across warehouse rows', () => {
  const rows = [
    { currentQuantity: 40, reservedQuantity: 5 },
    { currentQuantity: 12, reservedQuantity: 0 },
  ];
  assert.deepStrictEqual(computeRollup(rows), {
    totalStock: 52,
    reservedStock: 5,
    availableStock: 47,
  });
});

test('computeRollup handles empty list', () => {
  assert.deepStrictEqual(computeRollup([]), {
    totalStock: 0,
    reservedStock: 0,
    availableStock: 0,
  });
});

test('computeRollup treats missing fields as zero', () => {
  const rows = [{ currentQuantity: 10 }, {}];
  assert.deepStrictEqual(computeRollup(rows), {
    totalStock: 10,
    reservedStock: 0,
    availableStock: 10,
  });
});
