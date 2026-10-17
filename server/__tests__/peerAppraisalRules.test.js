const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateResult, validateRatings, validateRoster } = require('../services/peerAppraisal/rules');
test('bonus uses the unrounded mean and rounds money once', () => {
  assert.deepEqual(calculateResult([3, 4, 5], 5000000), { averageScore: 4, ratingCount: 3, bonusMinor: 4000000 });
  assert.equal(calculateResult([1, 1, 2], 10000).bonusMinor, 2667);
  assert.equal(calculateResult([5], 0).bonusMinor, 0);
  assert.throws(() => calculateResult([], 10000));
});
test('ratings require integer numbers and exact colleague membership', () => {
  for (const rating of [0, 6, 1.5, '5', null, NaN, Infinity]) {
    assert.throws(() => validateRatings(['a'], [{ subject: 'a', rating }], { complete: true }));
  }
  assert.throws(() => validateRatings(['a'], [{ subject: 'self', rating: 5 }]));
  assert.throws(() => validateRatings(['a'], [{ subject: 'a', rating: 5 }, { subject: 'a', rating: 4 }]));
  assert.throws(() => validateRatings(['a', 'b'], [{ subject: 'a', rating: 5 }], { complete: true }));
  assert.deepEqual(validateRatings(['a'], [], { complete: false }), []);
});
test('roster requires unique employees and finite nonnegative currency amounts', () => {
  assert.throws(() => validateRoster([{ employee: 'a', bonusAmount: 20 }]));
  for (const bonusAmount of [-1, NaN, Infinity, 1.001, '50', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => validateRoster([{ employee: 'a', bonusAmount }, { employee: 'b', bonusAmount: 0 }]));
  }
  assert.throws(() => validateRoster([{ employee: 'a', bonusAmount: 1 }, { employee: 'a', bonusAmount: 2 }]));
  assert.deepEqual(validateRoster([{ employee: 'a', bonusAmount: 50.25 }, { employee: 'b', bonusAmount: 0 }]), [
    { employee: 'a', allocationMinor: 5025 }, { employee: 'b', allocationMinor: 0 },
  ]);
});
