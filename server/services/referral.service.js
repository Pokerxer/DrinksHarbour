// server/services/referral.service.js
//
// The DB layer for the referral program. Every decision lives in
// referral.helpers.js; this file only reads, writes, and calls the atomic
// wallet mutator. Mirrors platformLoyalty.service.js.
//
// Two hard rules, both load-bearing:
//   1. Registration must NEVER fail because of a referral problem.
//   2. A payout must NEVER fail an order the customer already paid for.
// Every exported function is therefore total: it returns {ok:false, reason}
// rather than throwing, and its callers additionally wrap it in try/catch.

const crypto = require('crypto');
const Referral = require('../models/Referral');
const User = require('../models/User');
const {
  REFERRAL_CONFIG, normalizeCode, selfReferralReason,
  snapshotTerms, monthWindow, decideSettlement, decideReversal,
} = require('./referral.helpers');

// Base32 without the ambiguous 0/O/1/I — these codes get read off screens and
// retyped. Unguessable by design: until an order is placed the coupon is a
// bearer token, so it must not be enumerable.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomSuffix(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Record a referral at signup. Mints nothing — the referee's coupon is held
 * until their email is verified, which is the strongest anti-farm guard
 * available without device fingerprinting.
 */
async function createReferralOnSignup({ refereeId, code }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, reason: 'no_code' };

  const [referrer, referee] = await Promise.all([
    User.findOne({ referralCode: normalized }).select('_id email phone'),
    User.findById(refereeId).select('_id email phone'),
  ]);

  // A typo'd code must never block a signup.
  if (!referrer) return { ok: false, reason: 'unknown_code' };
  if (!referee)  return { ok: false, reason: 'no_referee' };

  const terms = snapshotTerms(REFERRAL_CONFIG);

  // Self-dealing is RECORDED, not dropped — a silently discarded attempt is
  // invisible later, and the pattern is what makes abuse legible.
  const selfReason = selfReferralReason(referrer, referee);
  if (selfReason) {
    const rejected = await safeCreate({
      referrer: referrer._id, referee: referee._id, code: normalized,
      status: 'rejected', rejectedReason: selfReason, terms,
    });
    return { ok: false, reason: selfReason, referral: rejected };
  }

  const referral = await safeCreate({
    referrer: referrer._id, referee: referee._id, code: normalized,
    status: 'pending', terms,
  });
  if (!referral) return { ok: false, reason: 'already_referred' };

  return { ok: true, referral };
}

/** Create, treating the referee unique-index violation as "already referred". */
async function safeCreate(doc) {
  try {
    return await Referral.create(doc);
  } catch (err) {
    if (err && err.code === 11000) return null; // unique index on `referee`
    throw err;
  }
}

/**
 * On email verification: award the referee their loyalty points and move the
 * referral to `qualified`. Idempotent — a second call finds no pending
 * referral and no-ops.
 */
async function qualifyReferral({ refereeId }) {
  const referral = await Referral.findOne({ referee: refereeId, status: 'pending' });
  if (!referral) return { ok: false, reason: 'no_pending_referral' };

  // Claim atomically — only one concurrent caller can win the race.
  const claimed = await Referral.findOneAndUpdate(
    { _id: referral._id, status: 'pending' },
    { $set: { status: 'qualified', qualifiedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return { ok: false, reason: 'already_qualified' };

  // Award loyalty points to the referee (best-effort — a points failure must
  // not strand the referral in a half-qualified state; log for manual fix).
  let pointsAwarded = false;
  try {
    const { mutatePlatformLoyalty } = require('./platformLoyalty.service');
    const pts = await mutatePlatformLoyalty({
      userId: claimed.referee,
      value: {
        type: 'referral',
        points: claimed.terms.refereeLoyaltyPoints,
        reason: 'Referral bonus for verifying your email',
      },
      reference: `referral-loyalty-${claimed._id}`,
      createdBy: claimed.referee,
    });
    pointsAwarded = pts.ok;
    if (!pts.ok) console.warn(`⚠️ Referral ${claimed._id}: loyalty points award failed — ${pts.message}`);
  } catch (err) {
    console.error('❌ Referral loyalty points error:', err.message);
  }

  await User.updateOne({ _id: claimed.referee }, { $set: { referredBy: claimed.referrer } });

  return { ok: true, referral: claimed, pointsAwarded };
}

/**
 * Pay the referrer when their referee's first order is PAID.
 *
 * Called from ALL THREE paid transitions — the storefront create path, the
 * Korapay webhook fallback, and the admin mark_paid action. At least two can
 * fire for the same order, so this must be idempotent. Two layers guarantee
 * that: the `status === 'paid'` check in decideSettlement, and — the atomic
 * layer — a claim-then-write findOneAndUpdate that only ONE concurrent caller
 * can win.
 *
 * The wallet reference (`referral-payout-<referralId>`) is deterministic, but
 * mutatePlatformWallet does NOT enforce reference uniqueness (the ledger
 * `reference` column is only sparse, no unique index), so it cannot be the
 * only backstop. Winning the claim IS the serialization point: exactly one
 * caller transitions the referral from `qualified`, and only the winner pays.
 */
async function settleReferralOnPaidOrder(order, now = new Date()) {
  if (!order || order.paymentStatus !== 'paid') return { ok: false, reason: 'order_not_paid' };

  const refereeId = order.user || order.customer;
  if (!refereeId) return { ok: false, reason: 'guest_order' };

  const referral = await Referral.findOne({ referee: refereeId, status: 'qualified' });
  if (!referral) return { ok: false, reason: 'no_qualified_referral' };

  const { start, end } = monthWindow(now);
  const paidCountThisMonth = await Referral.countDocuments({
    referrer: referral.referrer, status: 'paid', paidAt: { $gte: start, $lt: end },
  });

  const decision = decideSettlement({ referral, order, paidCountThisMonth });

  if (decision.action === 'reject') {
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { status: 'rejected', rejectedReason: decision.reason } },
    );
    // The referee KEEPS their discount — they did nothing wrong, and clawing
    // back a new customer's coupon to punish someone else is the wrong trade.
    return { ok: false, reason: decision.reason };
  }
  if (decision.action !== 'pay') return { ok: false, reason: decision.reason };

  const amount = referral.terms.referrerCreditNgn;

  // CLAIM FIRST — the atomic serialization point. Two concurrent callers both
  // pass decideSettlement's `pay` check; only ONE can transition this row out
  // of `qualified`, because the second findOneAndUpdate's filter
  // ({ _id, status: 'qualified' }) no longer matches. The loser sees a null
  // doc and returns `already_paid` — exactly one wallet credit ever happens,
  // no matter how many paid call sites race.
  const claimed = await Referral.findOneAndUpdate(
    { _id: referral._id, status: 'qualified' },
    { $set: { status: 'paid', paidAt: now, qualifyingOrder: order._id } },
    { new: true },
  );
  if (!claimed) return { ok: false, reason: 'already_paid' };

  const { mutatePlatformWallet } = require('./platformWallet.service');
  let credited;
  try {
    credited = await mutatePlatformWallet({
      owner: { userId: referral.referrer },
      value: {
        type: 'credit',
        amount,
        source: 'referral',
        reason: `Referral bonus — order ${order.orderNumber || order._id}`,
      },
      reference: `referral-payout-${referral._id}`,
      relatedOrder: order._id,
      createdBy: referral.referrer,
    });
  } catch (walletErr) {
    // Wallet DB hiccup — release the claim so the payout can be retried.
    // $set (NOT unset): a transient error must not strand the referral in a
    // half-paid state with no row to latch onto.
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { status: 'qualified', qualifyingOrder: null, paidAt: null } },
    );
    return { ok: false, reason: walletErr.message };
  }

  if (!credited.ok) {
    // Declined but not thrown (e.g. wallet owner missing) — release the claim.
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { status: 'qualified', qualifyingOrder: null, paidAt: null } },
    );
    return { ok: false, reason: credited.message };
  }

  // Best-effort payoutTxn backfill — a failure to persist the ledger id must
  // NOT fail a payout that already happened.
  try {
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { payoutTxn: credited.tx?._id || null } },
    );
  } catch (txnErr) {
    console.error('❌ Referral payoutTxn backfill failed:', txnErr.message);
  }

  return { ok: true, balance: credited.balance, referral: claimed };
}

/**
 * Claw the referrer's credit back when the qualifying order is refunded.
 *
 * Same claim-then-write discipline as settleReferralOnPaidOrder. Two concurrent
 * mark_refunded calls can race as separate processes: decideReversal's
 * `status === 'paid'` check only stops the SEQUENTIAL double-fire. The atomic
 * layer is a findOneAndUpdate that transitions the referral `paid → reversed`
 * so exactly ONE caller can win — the loser finds a non-`paid` row and returns
 * `already_reversed`. The wallet reference (`referral-reversal-<referralId>`)
 * is deterministic but NOT a backstop (the ledger `reference` column is sparse,
 * no unique index), so winning the claim is the serialization point.
 *
 * mutatePlatformWallet's overdraw guard is deliberate and load-bearing — every
 * other wallet caller relies on the balance never going negative. If the
 * referrer already spent the credit the debit fails and we record
 * `reversalFailed`. Because the wallet was NOT debited in that case, the claim
 * is torn back down to `paid` (NOT left `reversed`, as if the money had been
 * clawed back) so the shortfall stays visible and a later successful reversal
 * can retry it — the balance is never driven negative and the reversal is
 * recoverable.
 */
async function reverseReferralForOrder(order, now = new Date()) {
  if (!order) return { ok: false, reason: 'no_order' };

  const referral = await Referral.findOne({ qualifyingOrder: order._id, status: 'paid' });
  const decision = decideReversal({ referral, order });
  if (decision.action !== 'reverse') return { ok: false, reason: decision.reason };

  // CLAIM FIRST — the atomic serialization point. Only ONE concurrent caller
  // can transition this row out of `paid`; the second findOneAndUpdate's filter
  // ({ _id, status: 'paid' }) no longer matches and sees a null doc.
  const claimed = await Referral.findOneAndUpdate(
    { _id: referral._id, status: 'paid' },
    { $set: { status: 'reversed', reversedAt: now } },
    { new: true },
  );
  if (!claimed) return { ok: false, reason: 'already_reversed' };

  const { mutatePlatformWallet } = require('./platformWallet.service');
  let debited;
  try {
    debited = await mutatePlatformWallet({
      owner: { userId: referral.referrer },
      value: {
        type: 'debit',
        amount: referral.terms.referrerCreditNgn,
        source: 'referral',
        reason: `Referral reversed — order ${order.orderNumber || order._id} refunded`,
      },
      reference: `referral-reversal-${referral._id}`,
      relatedOrder: order._id,
      createdBy: referral.referrer,
    });
  } catch (walletErr) {
    // Wallet DB hiccup — the money was never debited. Tear the claim back to
    // `paid` so the reversal can be retried; never leave it `reversed` as if it
    // were collected.
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { status: 'paid', reversedAt: null, reversalFailed: true } },
    );
    console.warn(`⚠️ Referral ${referral._id} reversal retriable — wallet threw (${walletErr.message})`);
    return { ok: true, reason: 'debit_failed_or_overdrawn', reversalFailed: true };
  }

  if (!debited.ok) {
    // Debit declined (e.g. overdraw / owner spent the credit). The wallet was
    // NOT debited, so remove the clawed-back `reversed` claim and restore `paid`
    // — otherwise settle could RE-pay on a future mark_paid. `reversalFailed`
    // keeps the shortfall visible and recoverable by hand or a later retry.
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { status: 'paid', reversedAt: null, reversalFailed: true } },
    );
    console.warn(
      `⚠️ Referral ${referral._id} NOT collected - debit failed (${debited.message}) — ` +
      `referrer ${referral.referrer} owes ₦${referral.terms.referrerCreditNgn}`
    );
    return { ok: true, reversalFailed: true, reason: 'debit_failed_or_overdrawn' };
  }

  // Debit succeeded — the claim is already `reversed`. Clear the failure flag
  // and backfill the ledger id best-effort (must not fail the reversal).
  try {
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { reversalFailed: false, reversalTxn: debited.tx?._id || null } },
    );
  } catch (txnErr) {
    console.error('❌ Referral reversalTxn backfill failed:', txnErr.message);
  }

  return { ok: true, reason: 'reversed', reversalFailed: false };
}

/**
 * Apply a referral code for an ALREADY REGISTERED user who missed the link.
 * Runs the same guards, then immediately qualifies (their email is already
 * verified if they can reach this endpoint). Awards no points to anybody —
 * removing that was the point of this rewrite.
 */
async function applyReferralForExistingUser({ refereeId, code }) {
  const existing = await Referral.findOne({ referee: refereeId });
  if (existing) return { ok: false, status: 400, message: 'A referral has already been applied to this account' };

  const Order = require('../models/Order');
  // Order.customer is an embedded snapshot object (firstName/lastName/phone),
  // never a User ObjectId — the only order field that references a User is
  // `user`. A guest order (user: null) can't be attributed to this referee, so
  // the gate is `user` only.
  const priorPaid = await Order.countDocuments({
    user: refereeId, paymentStatus: 'paid',
  });
  if (priorPaid > 0) {
    return { ok: false, status: 400, message: 'Referral offers are for first-time customers' };
  }

  const created = await createReferralOnSignup({ refereeId, code });
  if (!created.ok) {
    const message = created.reason === 'unknown_code' ? 'Invalid referral code'
      : created.reason?.startsWith('self_') ? 'You cannot refer yourself'
      : created.reason === 'already_referred' ? 'A referral has already been applied to this account'
      : 'Referral code could not be applied';
    return { ok: false, status: 400, message };
  }

  const user = await User.findById(refereeId).select('isEmailVerified');
  if (!user?.isEmailVerified) {
    return { ok: true, referral: created.referral, message: 'Referral applied — verify your email to unlock your discount' };
  }

  const qualified = await qualifyReferral({ refereeId });
  return {
    ok: true,
    referral: qualified.referral || created.referral,
    pointsAwarded: qualified.pointsAwarded || false,
    message: 'Referral applied — your loyalty points have been credited',
  };
}

module.exports = { createReferralOnSignup, qualifyReferral, settleReferralOnPaidOrder, reverseReferralForOrder, applyReferralForExistingUser, randomSuffix };
