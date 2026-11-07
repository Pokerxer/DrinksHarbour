'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { billTotals } = require('../services/venue/billing');
test('future_platform_commission_excludes_tax_and_direct_visits_have_no_new_fee', () => {
  const lines = [{ netMinor: 100000, taxMinor: 7500 }];
  assert.deepEqual(billTotals(lines, 900), { netMinor: 100000, taxMinor: 7500, totalMinor: 107500, commissionMinor: 9000, tenantShareMinor: 98500 });
  assert.equal(billTotals(lines, 0).commissionMinor, 0);
});
test('invalid_zero_or_overflow_bill_amounts_are_refused', () => {
  for (const lines of [[], [{ netMinor: -1, taxMinor: 0 }], [{ netMinor: Number.MAX_SAFE_INTEGER, taxMinor: 1 }]]) assert.throws(() => billTotals(lines, 900));
});
