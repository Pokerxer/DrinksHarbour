// Why reversing the same refund twice must claw the credit back once.
//
// The admin mark_refunded action can fire more than once for one order (a
// double-click, a retried webhook, a re-issued request), so two concurrent
// calls can race in separate processes. decideReversal's `status === 'paid'`
// check only stops the SEQUENTIAL double-fire: two concurrent calls both read
// the referral as `paid` and both decide `reverse`. The wallet reference
// (`referral-reversal-<referralId>`) is NOT a backstop either, because
// mutatePlatformWallet's ledger `reference` column is only sparse — no unique
// index — so the debit would land twice.
//
// The real latch is the atomic claim: reverseReferralForOrder must transition
// the referral `paid → reversed` with a findOneAndUpdate BEFORE debiting the
// wallet, so exactly one caller can win and the balance can never be driven
// negative by a double-reverse. These tests pin that behaviour.
//
// Second, the reversalFailed branch must NEVER call a positive wallet mutation
// — the credit is only ever clawed back if the debit actually succeeded. A
// failed debit must restore the claim to `paid` (recoverable) and record
// `reversalFailed` rather than punching through the balance non-negative
// invariant.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { decideReversal } = require('../services/referral.helpers');

const COUPON = 'c1';
const base = (over = {}) => ({
  _id: 'r1', status: 'paid', coupon: COUPON, qualifyingOrder: 'o1',
  terms: { referrerCreditNgn: 2000, refereeDiscountNgn: 2000, minSpendNgn: 15000 },
  ...over,
});
const refundedOrder = (over = {}) => ({
  _id: 'o1', paymentStatus: 'refunded', totalAmount: 20000, ...over,
});

test('decideReversal skips a referral that was never paid', () => {
  const d = decideReversal({
    referral: base({ status: 'qualified' }), order: refundedOrder(),
  });
  assert.strictEqual(d.action, 'skip');
});

test('decideReversal skips a referral that is already reversed', () => {
  const d = decideReversal({
    referral: base({ status: 'reversed' }), order: refundedOrder(),
  });
  assert.strictEqual(d.action, 'skip');
});

test('reverseReferralForOrder binds decideReversal from the helpers import', () => {
  // Live smoke-test regression (2026-09-05): the service destructured only
  // `decideSettlement` from referral.helpers; `decideReversal` was a free
  // variable resolved at CALL time, so the module loaded and every test
  // passed, but `reverseReferralForOrder(order)` threw ReferenceError the
  // moment a real refund ran. Pin BOTH the import presence and the binding.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'referral.service.js'),
    'utf8',
  );

  const requireMatch = src.match(/require\('\.\/referral\.helpers'\)/);
  assert.ok(requireMatch, 'must import referral.helpers');
  const requireSrc = src.slice(0, requireMatch.index);
  assert.match(requireSrc, /\bdecideReversal\b/,
    'decideReversal must be destructured from referral.helpers, or reverseReferralForOrder throws ReferenceError at runtime');

  const start = src.indexOf('async function reverseReferralForOrder');
  assert.notStrictEqual(start, -1, 'reverseReferralForOrder must exist');
  const reverseSrc = src.slice(start);
  assert.match(reverseSrc, /\bdecideReversal\s*\(/,
    'the reverse path must call decideReversal, not a rolled-from-scratch decision');
});

test('reverseReferralForOrder claims the row with findOneAndUpdate, not a bare findById + save', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'referral.service.js'),
    'utf8',
  );

  const start = src.indexOf('async function reverseReferralForOrder');
  assert.notStrictEqual(start, -1, 'reverseReferralForOrder must exist');
  const reverseSrc = src.slice(start);

  assert.match(reverseSrc, /findOneAndUpdate\(\s*\{\s*_id: referral\._id,\s*status: 'paid'\s*\}/s,
    'the reversal must atomically claim the referral (paid → reversed) so only ONE concurrent caller can win');

  assert.doesNotMatch(reverseSrc, /referral\.save\(\)/,
    'the reverse path must NOT read-modify-write the referral — a bare .save() is a non-atomic claim that two concurrent callers could both win');
});

test('a failed debit restores the claim and never drives the balance negative', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'referral.service.js'),
    'utf8',
  );

  const start = src.indexOf('async function reverseReferralForOrder');
  assert.notStrictEqual(start, -1, 'reverseReferralForOrder must exist');
  const reverseSrc = src.slice(start);

  const failedBranch = reverseSrc.slice(reverseSrc.indexOf('if (!debited.ok)'));
  assert.match(failedBranch, /status: 'paid'/,
    'a failed debit must restore the claim to `paid` so the reversal stays recoverable and settle cannot re-pay a half-reversed row');
  assert.match(failedBranch, /reversalFailed: true/,
    'a failed debit must record reversalFailed so the shortfall stays visible');

  // The whole reverse function must only ever DEBIT the wallet — never credit.
  assert.match(reverseSrc, /type: 'debit'/s,
    'the reversal must only ever debit the wallet');
  assert.doesNotMatch(reverseSrc, /type: 'credit'/,
    'the reversal must NEVER call a positive wallet mutation — a failed debit must not drive the balance negative');
});
