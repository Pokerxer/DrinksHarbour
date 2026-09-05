// Pure rules for the referral program. No DB, no clock — every function that
// makes a decision takes `now` as a parameter so the boundaries are testable.

const test = require('node:test');
const assert = require('node:assert');

const {
  REFERRAL_CONFIG, normalizeCode, selfReferralReason, monthWindow,
  isOverMonthlyCap, snapshotTerms, summarizeReferrals,
} = require('../services/referral.helpers');

const oid = (s) => ({ toString: () => s, equals: (o) => String(o) === s });

test('config carries the agreed terms', () => {
  assert.strictEqual(REFERRAL_CONFIG.refereeLoyaltyPoints, 2000);
  assert.strictEqual(REFERRAL_CONFIG.referrerCreditNgn, 2000);
  assert.strictEqual(REFERRAL_CONFIG.minSpendNgn, 50000);
  assert.strictEqual(REFERRAL_CONFIG.maxPayoutsPerMonth, 10);
});

test('normalizeCode uppercases and trims; blank is null', () => {
  assert.strictEqual(normalizeCode('  dh-ab23cd '), 'DH-AB23CD');
  assert.strictEqual(normalizeCode(''), null);
  assert.strictEqual(normalizeCode('   '), null);
  assert.strictEqual(normalizeCode(null), null);
  assert.strictEqual(normalizeCode(undefined), null);
  assert.strictEqual(normalizeCode(12345), null);
});

test('self-referral is caught by id', () => {
  const u = { _id: oid('a1'), email: 'a@x.com', phoneNumber: '08030000001' };
  assert.strictEqual(selfReferralReason(u, u), 'self_id');
});

test('self-referral is caught by email regardless of case or whitespace', () => {
  const referrer = { _id: oid('a1'), email: 'Ada@X.com ', phoneNumber: '08030000001' };
  const referee  = { _id: oid('b2'), email: ' ada@x.COM', phoneNumber: '08030000002' };
  assert.strictEqual(selfReferralReason(referrer, referee), 'self_email');
});

test('self-referral is caught by phone across formats', () => {
  const referrer = { _id: oid('a1'), email: 'a@x.com', phoneNumber: '08030000001' };
  const referee  = { _id: oid('b2'), email: 'b@x.com', phoneNumber: '+2348030000001' };
  assert.strictEqual(selfReferralReason(referrer, referee), 'self_phone');
});

test('self-referral is caught by the REAL User field (`phone`), not just the legacy alias', () => {
  // The User schema field is `phone` (User.js); registration formerly wrote the
  // stripped `phoneNumber`, so this guard must read the field a DB query actually
  // returns. Pins the review finding that self_phone never fired from DB docs.
  const referrer = { _id: oid('a1'), email: 'a@x.com', phone: '08030000001' };
  const referee  = { _id: oid('b2'), email: 'b@x.com', phone: '+2348030000001' };
  assert.strictEqual(selfReferralReason(referrer, referee), 'self_phone');
});

test('distinct people are not self-referrals', () => {
  const referrer = { _id: oid('a1'), email: 'a@x.com', phoneNumber: '08030000001' };
  const referee  = { _id: oid('b2'), email: 'b@x.com', phoneNumber: '08030000002' };
  assert.strictEqual(selfReferralReason(referrer, referee), null);
});

test('missing contact fields never produce a false positive', () => {
  const referrer = { _id: oid('a1'), email: 'a@x.com', phoneNumber: null };
  const referee  = { _id: oid('b2'), email: 'b@x.com', phoneNumber: undefined };
  assert.strictEqual(selfReferralReason(referrer, referee), null);
});

test('monthWindow spans the calendar month of `now` in UTC', () => {
  const { start, end } = monthWindow(new Date('2026-09-05T13:45:00Z'));
  assert.strictEqual(start.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.strictEqual(end.toISOString(),   '2026-10-01T00:00:00.000Z');
});

test('monthWindow handles a December → January rollover', () => {
  const { start, end } = monthWindow(new Date('2026-12-31T23:59:59Z'));
  assert.strictEqual(start.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.strictEqual(end.toISOString(),   '2027-01-01T00:00:00.000Z');
});

test('cap boundary: 9 under, 10 over, 11 over', () => {
  assert.strictEqual(isOverMonthlyCap(9,  REFERRAL_CONFIG), false);
  assert.strictEqual(isOverMonthlyCap(10, REFERRAL_CONFIG), true);
  assert.strictEqual(isOverMonthlyCap(11, REFERRAL_CONFIG), true);
});

test('snapshotTerms copies by value — a later config edit cannot mutate it', () => {
  const cfg = { ...REFERRAL_CONFIG };
  const terms = snapshotTerms(cfg);
  cfg.referrerCreditNgn = 999999;
  assert.strictEqual(terms.referrerCreditNgn, 2000);
  assert.deepStrictEqual(Object.keys(terms).sort(),
    ['minSpendNgn', 'refereeLoyaltyPoints', 'referrerCreditNgn']);
});

test('summarizeReferrals counts statuses and money correctly', () => {
  const s = summarizeReferrals([
    { status: 'paid',      terms: { referrerCreditNgn: 2000 } },
    { status: 'paid',      terms: { referrerCreditNgn: 2000 } },
    { status: 'qualified', terms: { referrerCreditNgn: 2000 } },
    { status: 'pending',   terms: { referrerCreditNgn: 2000 } },
    { status: 'rejected',  terms: { referrerCreditNgn: 2000 } },
    { status: 'reversed',  terms: { referrerCreditNgn: 2000 } },
  ]);
  assert.strictEqual(s.joined, 6);
  assert.strictEqual(s.ordered, 2);
  assert.strictEqual(s.earnedNgn, 4000, 'only paid referrals count as earned');
  assert.strictEqual(s.pendingNgn, 4000, 'pending + qualified are still in flight');
});

test('summarizeReferrals on an empty list is all zeroes', () => {
  assert.deepStrictEqual(summarizeReferrals([]),
    { joined: 0, ordered: 0, earnedNgn: 0, pendingNgn: 0 });
});
