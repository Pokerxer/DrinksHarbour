// The settle/reverse decisions, isolated from Mongo. Idempotency lives here:
// an order reaches `paid` in three separate code paths (storefront create,
// Korapay webhook fallback, admin mark_paid) and two of them can fire for the
// same order, so "already paid" MUST be a no-op rather than a second credit.

const test = require('node:test');
const assert = require('node:assert');

const { decideSettlement, decideReversal, REFERRAL_CONFIG } =
  require('../services/referral.helpers');

const base = (over = {}) => ({
  _id: 'r1', status: 'qualified', coupon: null,
  terms: { referrerCreditNgn: 2000, refereeLoyaltyPoints: 2000, minSpendNgn: 50000 },
  ...over,
});
const paidOrder = (over = {}) => ({
  _id: 'o1', paymentStatus: 'paid', coupon: null, totalAmount: 60000, ...over,
});

test('a qualified referral on a paid order above the minimum spend pays out', () => {
  const d = decideSettlement({ referral: base(), order: paidOrder(), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'pay');
});

test('settling an already-paid referral is a no-op — this is the idempotency guard', () => {
  const d = decideSettlement({ referral: base({ status: 'paid' }), order: paidOrder(), paidCountThisMonth: 1 });
  assert.strictEqual(d.action, 'skip');
  assert.match(d.reason, /already/i);
});

test('an unpaid order never pays out', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder({ paymentStatus: 'pending' }), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'skip');
});

test('an order below the minimum spend does not pay out', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder({ totalAmount: 49999 }), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'skip');
  assert.strictEqual(d.reason, 'below_min_spend');
});

test('an order at exactly the minimum spend pays out', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder({ totalAmount: 50000 }), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'pay');
});

test('over the monthly cap rejects without paying', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder(),
    paidCountThisMonth: REFERRAL_CONFIG.maxPayoutsPerMonth });
  assert.strictEqual(d.action, 'reject');
  assert.strictEqual(d.reason, 'monthly_cap');
});

test('exactly at the cap minus one still pays', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder(),
    paidCountThisMonth: REFERRAL_CONFIG.maxPayoutsPerMonth - 1 });
  assert.strictEqual(d.action, 'pay');
});

test('a pending referral (email never verified) does not pay', () => {
  const d = decideSettlement({ referral: base({ status: 'pending' }), order: paidOrder(), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'skip');
});

test('a missing referral is a no-op, not a crash', () => {
  assert.strictEqual(decideSettlement({ referral: null, order: paidOrder(), paidCountThisMonth: 0 }).action, 'skip');
});

test('a fully refunded qualifying order reverses', () => {
  const d = decideReversal({
    referral: base({ status: 'paid', qualifyingOrder: 'o1' }),
    order: paidOrder({ paymentStatus: 'refunded' }) });
  assert.strictEqual(d.action, 'reverse');
});

test('a partial refund still above the minimum spend does NOT reverse', () => {
  const d = decideReversal({
    referral: base({ status: 'paid', qualifyingOrder: 'o1' }),
    order: paidOrder({ paymentStatus: 'partially_refunded', totalAmount: 60000,
                       refundDetails: { amount: 5000 } }) });
  assert.strictEqual(d.action, 'skip', '₦55,000 still clears the ₦50,000 floor');
});

test('a partial refund that drops below the minimum spend DOES reverse', () => {
  const d = decideReversal({
    referral: base({ status: 'paid', qualifyingOrder: 'o1' }),
    order: paidOrder({ paymentStatus: 'partially_refunded', totalAmount: 60000,
                       refundDetails: { amount: 15000 } }) });
  assert.strictEqual(d.action, 'reverse', '₦45,000 is below the ₦50,000 floor');
});

test('reversing a referral that was never paid is a no-op', () => {
  const d = decideReversal({
    referral: base({ status: 'qualified' }), order: paidOrder({ paymentStatus: 'refunded' }) });
  assert.strictEqual(d.action, 'skip');
});

test('reversing twice is a no-op', () => {
  const d = decideReversal({
    referral: base({ status: 'reversed' }), order: paidOrder({ paymentStatus: 'refunded' }) });
  assert.strictEqual(d.action, 'skip');
});
