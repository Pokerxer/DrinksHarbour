// server/__tests__/salesFulfill.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  outstanding,
  applyFulfillment,
  fulfillStatus,
  buildPostingLines,
} = require('../services/salesFulfill.helpers');

const line = (over = {}) => ({
  _id: 'L1', quantity: 100, fulfilledQty: 0, postedQty: 0, returnedQty: 0, ...over,
});

test('outstanding subtracts fulfilled and returned, never below zero', () => {
  assert.strictEqual(outstanding(line()), 100);
  assert.strictEqual(outstanding(line({ fulfilledQty: 60 })), 40);
  assert.strictEqual(outstanding(line({ fulfilledQty: 100, returnedQty: 0 })), 0);
  assert.strictEqual(outstanding(line({ fulfilledQty: 60, returnedQty: 50 })), 0);
});

test('applyFulfillment accumulates and clamps to ordered quantity', () => {
  const items = [line({ fulfilledQty: 60 })];
  const { lines } = applyFulfillment(items, [{ lineId: 'L1', qty: 80 }]);
  assert.strictEqual(lines.length, 1);
  assert.deepStrictEqual(lines[0], {
    lineId: 'L1', previousFulfilledQty: 60, newFulfilledQty: 100, delta: 40,
  });
});

test('applyFulfillment allowOver permits exceeding ordered quantity', () => {
  const { lines } = applyFulfillment([line()], [{ lineId: 'L1', qty: 120 }], { allowOver: true });
  assert.strictEqual(lines[0].newFulfilledQty, 120);
  assert.strictEqual(lines[0].delta, 120);
});

test('applyFulfillment skips zero/negative and unknown lines', () => {
  const { lines } = applyFulfillment([line()], [
    { lineId: 'L1', qty: 0 }, { lineId: 'NOPE', qty: 5 },
  ]);
  assert.strictEqual(lines.length, 0);
});

test('fulfillStatus reflects partial vs full vs none', () => {
  assert.strictEqual(fulfillStatus([line()]), null);
  assert.strictEqual(fulfillStatus([line({ fulfilledQty: 50 })]), 'partially_fulfilled');
  assert.strictEqual(fulfillStatus([line({ fulfilledQty: 100 })]), 'fulfilled');
  assert.strictEqual(
    fulfillStatus([line({ fulfilledQty: 100 }), line({ _id: 'L2', fulfilledQty: 10 })]),
    'partially_fulfilled'
  );
});

test('buildPostingLines projects the unposted delta only', () => {
  const out = buildPostingLines([
    line({ fulfilledQty: 60, postedQty: 40 }),   // delta 20
    line({ _id: 'L2', fulfilledQty: 10, postedQty: 10 }), // delta 0 -> skipped
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].qty, 20);
  assert.strictEqual(out[0]._id, 'L1');
});
