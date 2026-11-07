'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { venuePostings } = require('../services/venue/accounting');
const bill = { venueBillSnapshot: { netMinor: 100000, taxMinor: 0, totalMinor: 100000, commissionMinor: 9000, tenantShareMinor: 91000, acceptedLines: [{ quantity: 1, costMinor: 50000 }] } };
test('platform_paystack_posts_one_balanced_sale_and_cogs', () => {
  const entries = venuePostings(bill, { provider: 'paystack' });
  assert.deepEqual(entries[0].lines, [{ account: '1300', debit: 910, credit: 0 }, { account: '6000', debit: 90, credit: 0 }, { account: '4000', debit: 0, credit: 1000 }]);
  assert.deepEqual(entries[1].lines, [{ account: '5000', debit: 500, credit: 0 }, { account: '1200', debit: 0, credit: 500 }]);
});
test('direct_cash_has_no_platform_fee_and_separates_configured_tax', () => {
  const order = { venueBillSnapshot: { ...bill.venueBillSnapshot, commissionMinor: 0, tenantShareMinor: 107500, totalMinor: 107500, taxMinor: 7500 } };
  assert.deepEqual(venuePostings(order, { provider: 'cash' })[0].lines, [{ account: '1000', debit: 1075, credit: 0 }, { account: '4000', debit: 0, credit: 1000 }, { account: '2100', debit: 0, credit: 75 }]);
});
