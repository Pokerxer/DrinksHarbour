// The Referral schema's invariants are enforced by indexes, not app code.
// This pins them so a later schema edit cannot quietly relax them.

const test = require('node:test');
const assert = require('node:assert');

const Referral = require('../models/Referral');
const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');

test('referee is unique — one referral per account, ever', () => {
  assert.strictEqual(Referral.schema.path('referee').options.unique, true,
    'without this, two concurrent signups can both refer the same person');
});

test('status enum covers the whole lifecycle', () => {
  assert.deepStrictEqual(
    [...Referral.schema.path('status').enumValues].sort(),
    ['paid', 'pending', 'qualified', 'rejected', 'reversed']);
});

test('terms are stored on the referral, not read from config at payout', () => {
  for (const p of ['terms.refereeLoyaltyPoints', 'terms.referrerCreditNgn', 'terms.minSpendNgn']) {
    assert.ok(Referral.schema.path(p), `${p} must be snapshotted on the referral`);
  }
});

test('the monthly-cap query is indexed', () => {
  const keys = Referral.schema.indexes().map(([k]) => JSON.stringify(k));
  assert.ok(keys.some(k => k.includes('referrer') && k.includes('status')),
    'the cap counts paid referrals per referrer per month — it needs an index');
});

test('wallet ledger can express a referral payout distinctly', () => {
  assert.ok(PlatformWalletTransaction.schema.path('source').enumValues.includes('referral'),
    'overloading "adjustment" makes referral spend unseparable in the ledger');
});
