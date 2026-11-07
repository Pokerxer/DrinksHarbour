'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../services/venue/cost-math');

test('quantity normalizes exact decimal volume and mass without binary rounding', () => {
  assert.deepEqual(math.quantityFrom(0.29, 'ml'), { amountScaled: 29, scale: 100, unit: 'ml' });
  assert.deepEqual(math.quantityFrom(1.25, 'kg'), { amountScaled: 125000, scale: 100, unit: 'g' });
  assert.deepEqual(math.quantityFrom(0.00001, 'l'), { amountScaled: 1, scale: 100, unit: 'ml' });
  assert.deepEqual(math.quantityFrom(3, 'count'), { amountScaled: 3, scale: 1, unit: 'count' });
});

test('unsupported precision, nonfinite numbers and unsafe quantities are refused', () => {
  for (const [value, unit] of [[0.001, 'ml'], [1.001, 'g'], [1.5, 'count'], [0, 'g'], [-1, 'g'], [NaN, 'ml'], [Infinity, 'ml'], ['1', 'ml'], [1, 'bottle'], [Number.MAX_SAFE_INTEGER, 'kg']]) {
    assert.throws(() => math.quantityFrom(value, unit), { code: 'INVALID_QUANTITY' });
  }
  for (const quantity of [{ amountScaled: 1, scale: 1, unit: 'g' }, { amountScaled: 1.1, scale: 100, unit: 'g' }, { amountScaled: -1, scale: 100, unit: 'ml' }]) {
    assert.throws(() => math.assertQuantity(quantity), { code: 'INVALID_QUANTITY' });
  }
  assert.deepEqual(math.assertQuantity({ amountScaled: 0, scale: 100, unit: 'g' }, { allowZero: true }), { amountScaled: 0, scale: 100, unit: 'g' });
});

test('a three-unit fire scales every component exactly and rejects overflow', () => {
  assert.deepEqual(math.multiplyQuantity({ amountScaled: 1255, scale: 100, unit: 'g' }, 3), { amountScaled: 3765, scale: 100, unit: 'g' });
  assert.throws(() => math.multiplyQuantity({ amountScaled: Number.MAX_SAFE_INTEGER, scale: 1, unit: 'count' }, 2), { code: 'INVALID_QUANTITY' });
  assert.throws(() => math.multiplyQuantity({ amountScaled: 1, scale: 1, unit: 'count' }, 1.5), { code: 'INVALID_QUANTITY' });
});

test('source prefix allocations conserve the final remainder instead of rounding each issue', () => {
  assert.deepEqual([0, 1, 2].map(issuedBeforeScaled => math.allocateSourceCost({ costMinor: 100, quantityScaled: 3, issuedBeforeScaled, issueScaled: 1 })), [33, 33, 34]);
  assert.equal(math.allocateSourceCost({ costMinor: 100, quantityScaled: 3, issuedBeforeScaled: 1, issueScaled: 2 }), 67);
  assert.equal(math.allocateSourceCost({ costMinor: 0, quantityScaled: 3, issueScaled: 3 }), 0);
  assert.throws(() => math.allocateSourceCost({ costMinor: null, quantityScaled: 3, issueScaled: 1 }), { code: 'INVALID_MONEY' });
  assert.throws(() => math.allocateSourceCost({ costMinor: 100, quantityScaled: 3, issuedBeforeScaled: 2, issueScaled: 2 }), { code: 'INVALID_QUANTITY' });
});

test('large source products remain exact even when intermediate multiplication exceeds safe Number range', () => {
  assert.equal(math.allocateSourceCost({ costMinor: Number.MAX_SAFE_INTEGER, quantityScaled: 3, issueScaled: 2 }), 6004799503160660);
  assert.equal(math.sumMinor([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 3]), 3);
  assert.throws(() => math.sumMinor([Number.MAX_SAFE_INTEGER, 1]), { code: 'INVALID_MONEY' });
  assert.throws(() => math.requireMinor(1.5), { code: 'INVALID_MONEY' });
  assert.throws(() => math.requireMinor(-1), { code: 'INVALID_MONEY' });
});

test('package largest remainder uses stable IDs for equal ties, independent of input order', () => {
  assert.deepEqual(math.largestRemainderAllocation(10001, [{ componentId: 'c', weight: 1 }, { componentId: 'a', weight: 1 }, { componentId: 'b', weight: 1 }]), [
    { componentId: 'c', amountMinor: 3333 }, { componentId: 'a', amountMinor: 3334 }, { componentId: 'b', amountMinor: 3334 },
  ]);
  assert.deepEqual(math.largestRemainderAllocation(7, [{ componentId: 'paid', weight: 3 }, { componentId: 'included', weight: 0 }, { componentId: 'other', weight: 1 }]), [
    { componentId: 'paid', amountMinor: 5 }, { componentId: 'included', amountMinor: 0 }, { componentId: 'other', amountMinor: 2 },
  ]);
});

test('package zero weights, ambiguous IDs, unsafe/negative/fractional weights are refused', () => {
  for (const rows of [[], [{ componentId: 'a', weight: 0 }], [{ componentId: 'a', weight: -1 }], [{ componentId: 'a', weight: 1.1 }], [{ componentId: 'a', weight: 1 }, { componentId: 'a', weight: 2 }], [{ componentId: '', weight: 1 }]]) {
    assert.throws(() => math.largestRemainderAllocation(10001, rows), { code: 'INVALID_ALLOCATION' });
  }
});
