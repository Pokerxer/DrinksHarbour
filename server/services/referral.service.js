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
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const {
  REFERRAL_CONFIG, normalizeCode, selfReferralReason,
  couponExpiryFrom, snapshotTerms, monthWindow, decideSettlement,
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
 * On email verification: mint the referee's welcome coupon and move the
 * referral to `qualified`. Idempotent — a second call finds no pending
 * referral and no-ops.
 */
async function qualifyReferral({ refereeId }) {
  const referral = await Referral.findOne({ referee: refereeId, status: 'pending' });
  if (!referral) return { ok: false, reason: 'no_pending_referral' };

  const coupon = await Coupon.create({
    code: `WELCOME-${randomSuffix()}`,
    name: `Referral welcome — ₦${referral.terms.refereeDiscountNgn.toLocaleString()} off`,
    description: `A friend referred you. ₦${referral.terms.refereeDiscountNgn.toLocaleString()} off your first order over ₦${referral.terms.minSpendNgn.toLocaleString()}.`,
    discountType: 'fixed_amount',
    discountValue: referral.terms.refereeDiscountNgn,
    currency: 'NGN',
    minimumPurchaseAmount: referral.terms.minSpendNgn,
    allowedUsers: [referral.referee],
    firstPurchaseOnly: true,
    usageLimit: 1,
    usageLimitPerUser: 1,
    isReferralCoupon: true,
    referredBy: referral.referrer,
    referralReward: referral.terms.referrerCreditNgn,
    startDate: new Date(),
    endDate: couponExpiryFrom(referral.signupAt, REFERRAL_CONFIG),
    status: 'active',
    isActive: true,
    isGlobal: true,                    // platform-wide, i.e. not tenant-scoped;
    canCombineWithOtherCoupons: false, // allowedUsers is what restricts it
  });

  referral.coupon = coupon._id;
  referral.status = 'qualified';
  referral.qualifiedAt = new Date();
  await referral.save();

  await User.updateOne({ _id: referral.referee }, { $set: { referredBy: referral.referrer } });

  return { ok: true, referral, coupon };
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

module.exports = { createReferralOnSignup, qualifyReferral, settleReferralOnPaidOrder, randomSuffix };
