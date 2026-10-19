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
    { employee: 'a', allocationMinor: 5025, isAppraiser: true }, { employee: 'b', allocationMinor: 0, isAppraiser: true },
  ]);
});

test('roster preserves explicit appraiser selection and defaults legacy entries to appraisers', () => {
  const rows = validateRoster([
    { employee: 'a', bonusAmount: 50, isAppraiser: true },
    { employee: 'b', bonusAmount: 25 },
    { employee: 'c', bonusAmount: 10, isAppraiser: false },
  ]);
  assert.deepEqual(rows.map(p => p.isAppraiser), [true, true, false]);
});
test('every roster needs two appraisers and rejects non-boolean appraiser flags', () => {
  const base = [
    { employee: 'a', bonusAmount: 0, isAppraiser: true },
    { employee: 'b', bonusAmount: 0, isAppraiser: false },
    { employee: 'c', bonusAmount: 0, isAppraiser: false },
  ];
  assert.throws(() => validateRoster(base), /at least two appraisers/i);
  assert.throws(() => validateRoster(base.map(p => ({ ...p, isAppraiser: false }))), /at least two appraisers/i);
  for (const isAppraiser of ['false', 1, 0, null, {}, []]) {
    assert.throws(() => validateRoster([...base.slice(0, 1), { ...base[1], isAppraiser }]), /boolean/i);
  }
});

test('excluding self from eligible appraisers keeps perfect scores and bonuses equal', () => {
  const allocationMinor = 5000000;
  const appraiser = calculateResult(Array(9).fill(5), allocationMinor);
  const otherEmployee = calculateResult(Array(10).fill(5), allocationMinor);
  assert.equal(appraiser.ratingCount, 9);
  assert.equal(otherEmployee.ratingCount, 10);
  assert.equal(appraiser.averageScore, 5);
  assert.equal(otherEmployee.averageScore, 5);
  assert.equal(appraiser.bonusMinor, allocationMinor);
  assert.equal(otherEmployee.bonusMinor, allocationMinor);
});
