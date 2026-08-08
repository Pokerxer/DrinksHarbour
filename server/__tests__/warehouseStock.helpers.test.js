// server/__tests__/warehouseStock.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  computeRollup,
  assessSubProductDeletion,
} = require('../services/warehouseStock.helpers');

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

// ── assessSubProductDeletion ──────────────────────────────────────────────────
// Guards the SubProduct delete path. Deleting a SubProduct that still holds
// stock used to strand its WarehouseStock rows on an unresolvable id — populate
// returned null, `typeof null === 'object'` sent it down the "populated" branch,
// and the admin warehouse page threw during render.

test('assessSubProductDeletion blocks deletion when stock is on hand', () => {
  const res = assessSubProductDeletion([
    { _id: 'a', currentQuantity: 46, reservedQuantity: 0 },
    { _id: 'b', currentQuantity: 0, reservedQuantity: 0 },
  ]);
  assert.strictEqual(res.blocked, true);
  assert.strictEqual(res.totalQuantity, 46);
  assert.deepStrictEqual(res.blocking.map((r) => r._id), ['a']);
});

test('assessSubProductDeletion blocks on reserved-only stock', () => {
  // Reserved units are committed to an order — deleting is still destructive.
  const res = assessSubProductDeletion([
    { _id: 'a', currentQuantity: 0, reservedQuantity: 3 },
  ]);
  assert.strictEqual(res.blocked, true);
  assert.strictEqual(res.totalReserved, 3);
});

test('assessSubProductDeletion allows deletion when every line is empty', () => {
  const res = assessSubProductDeletion([
    { _id: 'a', currentQuantity: 0, reservedQuantity: 0 },
    { _id: 'b' },
  ]);
  assert.strictEqual(res.blocked, false);
  // Empty rows are removed with the SubProduct — that is what stops the dangle.
  assert.deepStrictEqual(res.removable.map((r) => r._id), ['a', 'b']);
});

test('assessSubProductDeletion allows deletion when there is no stock at all', () => {
  const res = assessSubProductDeletion([]);
  assert.strictEqual(res.blocked, false);
  assert.deepStrictEqual(res.removable, []);
  assert.strictEqual(res.totalQuantity, 0);
});

test('assessSubProductDeletion tolerates a missing/!array rows argument', () => {
  assert.strictEqual(assessSubProductDeletion(undefined).blocked, false);
  assert.strictEqual(assessSubProductDeletion(null).blocked, false);
});

test('assessSubProductDeletion ignores negative quantities', () => {
  // A negative on-hand is corrupt data, not stock worth protecting.
  const res = assessSubProductDeletion([
    { _id: 'a', currentQuantity: -5, reservedQuantity: 0 },
  ]);
  assert.strictEqual(res.blocked, false);
});
