// The settle/reverse decisions, isolated from Mongo. Idempotency lives here:
// an order reaches `paid` in three separate code paths (storefront create,
// Korapay webhook fallback, admin mark_paid) and two of them can fire for the
// same order, so "already paid" MUST be a no-op rather than a second credit.

const test = require('node:test');
const assert = require('node:assert');

const { decideSettlement, decideReversal, REFERRAL_CONFIG } =
  require('../services/referral.helpers');

const COUPON = 'c1';
const base = (over = {}) => ({
  _id: 'r1', status: 'qualified', coupon: COUPON,
  terms: { referrerCreditNgn: 2000, refereeDiscountNgn: 2000, minSpendNgn: 15000 },
  ...over,
});
const paidOrder = (over = {}) => ({
  _id: 'o1', paymentStatus: 'paid', coupon: COUPON, totalAmount: 20000, ...over,
});

test('a qualified referral on a paid order using the coupon pays out', () => {
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

test('an order that did not use the referral coupon never pays out', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder({ coupon: 'someOtherCoupon' }), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'skip');
  assert.match(d.reason, /coupon/i);
});

test('an order with no coupon at all never pays out', () => {
  const d = decideSettlement({
    referral: base(), order: paidOrder({ coupon: null }), paidCountThisMonth: 0 });
  assert.strictEqual(d.action, 'skip');
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
    order: paidOrder({ paymentStatus: 'partially_refunded', totalAmount: 20000,
                       refundDetails: { amount: 2000 } }) });
  assert.strictEqual(d.action, 'skip', '₦18,000 still clears the ₦15,000 floor');
});

test('a partial refund that drops below the minimum spend DOES reverse', () => {
  const d = decideReversal({
    referral: base({ status: 'paid', qualifyingOrder: 'o1' }),
    order: paidOrder({ paymentStatus: 'partially_refunded', totalAmount: 20000,
                       refundDetails: { amount: 8000 } }) });
  assert.strictEqual(d.action, 'reverse', '₦12,000 is below the ₦15,000 floor');
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
