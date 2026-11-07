'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { validateTender, validateVerifiedPayment } = require('../services/venue/collections');
test('cash_received_total_and_change_and_platform_cash_denied', () => {
  const bill = { totalMinor: 100000, acquisition: { kind: 'direct' }, posSessionId: 'drawer' };
  assert.deepEqual(validateTender(bill, { method: 'cash', amountTenderedMinor: 120000 }), { changeMinor: 20000 });
  assert.throws(() => validateTender({ ...bill, acquisition: { kind: 'platform' } }, { method: 'cash', amountTenderedMinor: 120000 }));
  for (const method of ['split', 'wallet', 'account', 'bank_transfer', 'card']) assert.throws(() => validateTender(bill, { method }));
});
test('provider_payment_requires_exact_stored_receipt_identity_and_minor_amount', () => {
  const attempt = { reference: 'dhv-ref', amountMinor: 100000, currency: 'NGN', purpose: 'venue_bill' };
  const data = { reference: 'dhv-ref', amountMinor: 100000, currency: 'NGN', transactionId: '123' };
  assert.equal(validateVerifiedPayment(attempt, { success: true, status: 'paid', data }).transactionId, '123');
  for (const extra of [{ amountMinor: 99999 }, { reference: 'wrong' }, { currency: 'USD' }, { transactionId: null }]) assert.throws(() => validateVerifiedPayment(attempt, { success: true, status: 'paid', data: { ...data, ...extra } }));
  assert.throws(() => validateVerifiedPayment(attempt, { success: true, status: 'pending', data }));
});
