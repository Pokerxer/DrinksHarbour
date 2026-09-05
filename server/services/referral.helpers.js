// server/services/referral.helpers.js
//
// Pure, DB-less rules for the referral reward program ("give ₦2,000, get
// ₦2,000"). Kept Mongo-free and clock-free so every guard and boundary is unit
// testable; the DB layer (referral.service.js) pairs these with atomic writes.
// Mirrors the platformLoyalty.helpers.js / platformLoyalty.service.js split.
//
// The referee gets a first-order discount coupon; the referrer is paid wallet
// credit ONLY once that order is paid. Nothing pays out on a signup — that was
// the defect this program replaces.

const { normalizePhone } = require('./contact.helpers');

const REFERRAL_CONFIG = {
  refereeDiscountNgn: 2000,   // ₦ off the referee's first order
  referrerCreditNgn:  2000,   // ₦ wallet credit to the referrer, on payment
  minSpendNgn:       15000,   // order floor for the coupon to apply
  couponValidDays:      30,   // referee's coupon lifetime from signup
  maxPayoutsPerMonth:   10,   // per referrer, counted on paidAt
};

/** Uppercase/trim a referral code. Non-strings and blanks are null. */
function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return c.length ? c : null;
}

function normEmail(e) {
  return typeof e === 'string' && e.trim() ? e.trim().toLowerCase() : null;
}

// normalizePhone() (contact.helpers.js) only strips whitespace/punctuation and
// a leading '+' — "0803..." and "+234803..." survive it as DIFFERENT strings.
// Take the last 10 digits on top of that so a local, +234 and bare-234 form of
// the same Nigerian number all collapse to one comparison key.
function normPhone(p) {
  if (!p) return null;
  const n = normalizePhone(p);
  if (!n) return null;
  const last10 = n.slice(-10);
  return last10.length === 10 ? last10 : null;
}

/**
 * Why a referral would be self-dealing, or null if it is legitimate.
 * Missing fields never match — an absent phone is not "the same phone".
 * @returns {null|'self_id'|'self_email'|'self_phone'}
 */
function selfReferralReason(referrer, referee) {
  if (!referrer || !referee) return null;

  const rid = referrer._id, eid = referee._id;
  if (rid && eid && String(rid) === String(eid)) return 'self_id';

  const re = normEmail(referrer.email), ee = normEmail(referee.email);
  if (re && ee && re === ee) return 'self_email';

  // User's real schema field is `phone` (User.js); `phoneNumber` is the legacy
  // alias some callers still write and the pure unit tests feed. Read both.
  const phoneOf = (u) => (u && (u.phoneNumber || u.phone)) || null;
  const rp = normPhone(phoneOf(referrer)), ep = normPhone(phoneOf(referee));
  if (rp && ep && rp === ep) return 'self_phone';

  return null;
}

/** UTC calendar month containing `now`, as a half-open [start, end) range. */
function monthWindow(now) {
  const d = new Date(now);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

function isOverMonthlyCap(paidCountThisMonth, config = REFERRAL_CONFIG) {
  return (Number(paidCountThisMonth) || 0) >= config.maxPayoutsPerMonth;
}

function couponExpiryFrom(signupAt, config = REFERRAL_CONFIG) {
  const base = new Date(signupAt);
  return new Date(base.getTime() + config.couponValidDays * 24 * 60 * 60 * 1000);
}

/**
 * Freeze the money terms at creation time. Payouts read the stored snapshot,
 * never the live constant — editing REFERRAL_CONFIG must not retroactively
 * rewrite an offer a customer already accepted.
 */
function snapshotTerms(config = REFERRAL_CONFIG) {
  return {
    refereeDiscountNgn: config.refereeDiscountNgn,
    referrerCreditNgn:  config.referrerCreditNgn,
    minSpendNgn:        config.minSpendNgn,
  };
}

/** Headline figures for the referrals page. Pure. */
function summarizeReferrals(referrals = []) {
  let joined = 0, ordered = 0, earnedNgn = 0, pendingNgn = 0;
  for (const r of referrals) {
    joined += 1;
    const credit = r.terms?.referrerCreditNgn || 0;
    if (r.status === 'paid') { ordered += 1; earnedNgn += credit; }
    else if (r.status === 'pending' || r.status === 'qualified') pendingNgn += credit;
  }
  return { joined, ordered, earnedNgn, pendingNgn };
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Should this paid order trigger a referral payout?
 *
 * Pure and total — callers pass the referral, the order, and how many payouts
 * the referrer has already had this month. Every "no" is a `skip` except the
 * cap, which is a `reject` because it must be recorded and shown to the user.
 *
 * The status check is the idempotency guard: an order reaches `paid` in three
 * separate code paths and at least two can fire for the same order.
 */
function decideSettlement({ referral, order, paidCountThisMonth = 0, config = REFERRAL_CONFIG }) {
  if (!referral) return { action: 'skip', reason: 'no_referral' };
  if (referral.status === 'paid')     return { action: 'skip', reason: 'already_paid' };
  if (referral.status === 'reversed') return { action: 'skip', reason: 'already_reversed' };
  if (referral.status === 'rejected') return { action: 'skip', reason: 'rejected' };
  if (referral.status !== 'qualified') return { action: 'skip', reason: 'not_qualified' };

  if (!order || order.paymentStatus !== 'paid') return { action: 'skip', reason: 'order_not_paid' };

  // The payout is contingent on a SALE that used the referee's coupon. The
  // ₦15,000 floor is enforced by the coupon itself at checkout (Task 1).
  if (!sameId(order.coupon, referral.coupon)) {
    return { action: 'skip', reason: 'order_did_not_use_referral_coupon' };
  }

  if (isOverMonthlyCap(paidCountThisMonth, config)) {
    return { action: 'reject', reason: 'monthly_cap' };
  }

  return { action: 'pay', reason: 'ok' };
}

/**
 * Should a refund claw the referrer's credit back?
 * A partial refund only reverses if the remaining paid amount falls below the
 * minimum spend the referral was snapshotted with — otherwise the sale still
 * qualifies and the referrer keeps the credit.
 */
function decideReversal({ referral, order }) {
  if (!referral) return { action: 'skip', reason: 'no_referral' };
  if (referral.status !== 'paid') return { action: 'skip', reason: 'not_paid' };
  if (!order) return { action: 'skip', reason: 'no_order' };

  if (order.paymentStatus === 'refunded') return { action: 'reverse', reason: 'refunded' };

  if (order.paymentStatus === 'partially_refunded') {
    const refunded  = Number(order.refundDetails?.amount) || 0;
    const remaining = (Number(order.totalAmount) || 0) - refunded;
    if (remaining < (referral.terms?.minSpendNgn || 0)) {
      return { action: 'reverse', reason: 'below_minimum_after_partial_refund' };
    }
    return { action: 'skip', reason: 'still_above_minimum' };
  }

  return { action: 'skip', reason: 'not_refunded' };
}

module.exports = {
  REFERRAL_CONFIG, normalizeCode, selfReferralReason, monthWindow,
  isOverMonthlyCap, couponExpiryFrom, snapshotTerms, summarizeReferrals,
  decideSettlement, decideReversal,
};
