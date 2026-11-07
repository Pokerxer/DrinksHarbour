'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { validateAllocationDraft } = require('../services/venue/payment-allocations');
const oid = '000000000000000000000001';
const valid = { tenantId: oid, locationId: oid, sessionId: oid, billOrderId: oid, receiptId: oid, purpose: 'venue_bill', currency: 'NGN', amountMinor: 100001, idempotencyKey: 'payment-1' };
test('safe_integer_kobo_only', () => {
  assert.equal(validateAllocationDraft(valid).amountMinor, 100001);
  for (const amountMinor of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateAllocationDraft({ ...valid, amountMinor }));
});
test('strict_currency_purpose_unknown_fields', () => {
  for (const extra of [{ currency: 'USD' }, { purpose: 'deposit' }, { clientTotal: 1 }]) assert.throws(() => validateAllocationDraft({ ...valid, ...extra }));
});
