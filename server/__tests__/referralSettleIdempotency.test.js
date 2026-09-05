// Why settling the same order twice must credit the referrer once.
//
// The storefront create path, the Korapay webhook fallback, and the admin
// mark_paid action can all fire for one order — so at least two of the three
// paid transitions can race in separate processes. decideSettlement's
// `status === 'paid'` check only stops the SEQUENTIAL double-fire: two
// concurrent calls both read the referral as `qualified` and both decide
// `pay`. The wallet reference (`referral-payout-<referralId>`) is NOT a
// backstop either, because mutatePlatformWallet's ledger `reference` column is
// only sparse — no unique index — so the $inc would land twice.
//
// The real latch is the atomic claim: settleReferralOnPaidOrder must transition
// the referral `qualified → paid` with a findOneAndUpdate BEFORE crediting the
// wallet, so exactly one caller can win. These two tests pin that behaviour:
// the first proves the pure decision genuinely double-fires (so a pure test
// alone would be insufficient), and the second pins the source to the atomic
// claim rather than a read-modify-write `.save()`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { decideSettlement } = require('../services/referral.helpers');

const base = (over = {}) => ({
  _id: 'r1', status: 'qualified', coupon: null,
  terms: { referrerCreditNgn: 2000, refereeLoyaltyPoints: 2000, minSpendNgn: 50000 },
  ...over,
});
const paidOrder = (over = {}) => ({
  _id: 'o1', paymentStatus: 'paid', coupon: null, totalAmount: 60000, ...over,
});

test('two concurrent settle calls seeing the same qualified referral BOTH decide pay — the status check alone does not serialize them', async () => {
  const referral = base();
  const [a, b] = await Promise.all([
    Promise.resolve(decideSettlement({ referral, order: paidOrder(), paidCountThisMonth: 0 })),
    Promise.resolve(decideSettlement({ referral, order: paidOrder(), paidCountThisMonth: 0 })),
  ]);
  assert.strictEqual(a.action, 'pay');
  assert.strictEqual(b.action, 'pay',
    'both callers observe the same unclaimed `qualified` row, which is exactly why the service must serialize on an atomic claim');
});

test('settleReferralOnPaidOrder claims the row with findOneAndUpdate, not a bare findById + save', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'referral.service.js'),
    'utf8',
  );

  const start = src.indexOf('async function settleReferralOnPaidOrder');
  assert.notStrictEqual(start, -1, 'settleReferralOnPaidOrder must exist');
  const settleSrc = src.slice(start);

  assert.match(settleSrc, /findOneAndUpdate\(\s*\{\s*_id: referral\._id,\s*status: 'qualified'\s*\}/s,
    'the payout must atomically claim the referral (qualified → paid) so only ONE concurrent caller can win');

  assert.doesNotMatch(settleSrc, /referral\.save\(\)/,
    'the settle path must NOT read-modify-write the referral — a bare .save() is a non-atomic claim that two concurrent callers could both win');
});