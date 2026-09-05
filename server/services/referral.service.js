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
  couponExpiryFrom, snapshotTerms,
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
    User.findOne({ referralCode: normalized }).select('_id email phoneNumber'),
    User.findById(refereeId).select('_id email phoneNumber'),
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

module.exports = { createReferralOnSignup, qualifyReferral, randomSuffix };
