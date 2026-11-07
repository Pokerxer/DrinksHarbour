'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const money = () => require('../services/venue/money-rules');
test('minimum spend is eligible net consumption and deposit credit never creates negative due', () => {
  const settle = (eligibleNetMinor, minimumMinor = 20000000) => money().balance({ merchandiseMinor: eligibleNetMinor, eligibleNetMinor, minimumMinor, creditMinor: 5000000 });
  assert.deepEqual(settle(23000000), { shortfallMinor: 0, totalMinor: 23000000, appliedCreditMinor: 5000000, unappliedCreditMinor: 0, dueMinor: 18000000 });
  assert.deepEqual(settle(16000000), { shortfallMinor: 4000000, totalMinor: 20000000, appliedCreditMinor: 5000000, unappliedCreditMinor: 0, dueMinor: 15000000 });
  assert.deepEqual(settle(4000000, 0), { shortfallMinor: 0, totalMinor: 4000000, appliedCreditMinor: 4000000, unappliedCreditMinor: 1000000, dueMinor: 0 });
  assert.throws(() => money().balance({ merchandiseMinor: 100, eligibleNetMinor: 101, minimumMinor: 0, creditMinor: 0 }), /eligible/i);
});
test('equal splits allocate exact deterministic kobo and reject ambiguous or unsafe money', () => {
  assert.deepEqual(money().equalSplit(1000000, 3), [333334,333333,333333]);
  for (const amount of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1, NaN]) assert.throws(() => money().equalSplit(amount, 3), /money/i);
  assert.throws(() => money().equalSplit(1, 3), /portion/i);
});
test('partial reversals preserve original allocations and cumulative rounding', () => {
  const original = { amountMinor: 100, commissionMinor: 9 };
  assert.deepEqual(money().refundShares(original, 33, 0), { commissionMinor: 2, tenantMinor: 31 });
  assert.deepEqual(money().refundShares(original, 33, 33), { commissionMinor: 3, tenantMinor: 30 });
  assert.deepEqual(money().refundShares(original, 34, 66), { commissionMinor: 4, tenantMinor: 30 });
  assert.throws(() => money().refundShares(original, 35, 66), /exceed/i);
});
test('item splits bind immutable accepted line revisions and cannot duplicate or forge a line', () => {
 const snapshot={acceptedLines:[{lineId:'line-a',revision:1,netMinor:100001,taxMinor:0},{lineId:'line-b',revision:2,netMinor:99999,taxMinor:0}]};
 assert.deepEqual(money().itemPortions(snapshot,[[{lineId:'line-a',revision:1}],[{lineId:'line-b',revision:2}]]).map(p=>p.amountMinor),[100001,99999]);
 assert.throws(()=>money().itemPortions(snapshot,[[{lineId:'line-a',revision:2}]]),/line/i);
 assert.throws(()=>money().itemPortions(snapshot,[[{lineId:'line-a',revision:1}],[{lineId:'line-a',revision:1}]]),/line/i);
});
