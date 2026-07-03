// server/services/platformLoyalty.helpers.js
//
// Pure, DB-less rules for the platform-wide (ecommerce) "Corks & Points" loyalty
// program — the online counterpart to the in-store loyalty section of
// contact.helpers.js. Kept Mongo-free so the tier math, points validation and
// earn-rate rules can be unit-tested in isolation; the atomic DB layer
// (platformLoyalty.service.js) pairs these with a guarded $inc.
//
// Tiers (business plan v6, "Corks & Points"): Cork → Barrel → Cellar → Vault.
// Points are NEVER redeemable for cash. Redeems convert points to a NGN wallet
// credit at a fixed rate; earn-rate scales slightly per tier.

const PLATFORM_LOYALTY_TX_TYPES = ['earn', 'redeem', 'adjustment', 'bonus', 'expiry', 'referral'];
const PLATFORM_LOYALTY_REASON_MAX = 280;

// Tier thresholds (lifetime points). Vault is the top tier.
const TIER_THRESHOLDS = {
  cork:   0,
  barrel: 2500,
  cellar: 7500,
  vault:  20000,
};

const TIER_ORDER = ['cork', 'barrel', 'cellar', 'vault'];

// Base earn rate: 1 point per NGN spent. Multiplier bumps at higher tiers.
const TIER_EARN_MULTIPLIER = {
  cork:   1,
  barrel: 1.1,
  cellar: 1.25,
  vault:  1.5,
};

// Redeem rate: 1 point = NGN 0.50 wallet credit (i.e. 100 pts = ₦50).
const POINTS_TO_NGN_RATE = 0.5;

// Referral bonus awarded to both referrer and referee on the referee's first
// completed order.
const REFERRAL_BONUS_POINTS = 500;

/**
 * Validate + normalise a platform-loyalty transaction request.
 * @returns {{ ok:true, value:{ type, points, reason } } | { ok:false, message }}
 */
function validatePlatformLoyaltyTx(body = {}) {
  const { type, points, reason } = body;

  if (!PLATFORM_LOYALTY_TX_TYPES.includes(type)) {
    return { ok: false, message: `Type must be one of: ${PLATFORM_LOYALTY_TX_TYPES.join(', ')}` };
  }

  const n = Number(points);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return { ok: false, message: 'Points must be a number' };
  }
  // adjustment may be negative; every other type is a positive magnitude.
  if (type !== 'adjustment' && (!Number.isInteger(n) || n <= 0)) {
    return { ok: false, message: 'Points must be a positive integer' };
  }
  if (type === 'adjustment' && !Number.isInteger(n)) {
    return { ok: false, message: 'Points must be an integer for an adjustment' };
  }

  const r = reason === undefined || reason === null ? '' : String(reason).trim();
  if (r.length > PLATFORM_LOYALTY_REASON_MAX) {
    return { ok: false, message: `Reason must be ${PLATFORM_LOYALTY_REASON_MAX} characters or fewer` };
  }

  return { ok: true, value: { type, points: n, reason: r } };
}

/**
 * Signed delta to apply to User.loyaltyPoints for a transaction. 'redeem' and
 * 'expiry' subtract (positive magnitude); 'adjustment' is already signed; every
 * other type adds.
 * @returns {number} integer delta (may be negative).
 */
function loyaltyDelta(type, points) {
  const n = Number(points) || 0;
  switch (type) {
    case 'redeem':
    case 'expiry':
      return -Math.abs(n);
    case 'adjustment':
      return n < 0 ? -Math.abs(n) : Math.abs(n);
    case 'earn':
    case 'bonus':
    case 'referral':
    default:
      return Math.abs(n);
  }
}

/**
 * Whether a transaction adds to the lifetime (non-redeemable) points total.
 * Only earn/bonus/referral (and positive adjustments) accrue lifetime points;
 * redeems and expiries do not lower it.
 */
function affectsLifetime(type) {
  return ['earn', 'bonus', 'referral'].includes(type);
}

/**
 * Compute the tier a customer should be in from their lifetime points.
 * @returns {'cork'|'barrel'|'cellar'|'vault'}
 */
function tierFromLifetimePoints(lifetimePoints = 0) {
  const lp = Number(lifetimePoints) || 0;
  if (lp >= TIER_THRESHOLDS.vault) return 'vault';
  if (lp >= TIER_THRESHOLDS.cellar) return 'cellar';
  if (lp >= TIER_THRESHOLDS.barrel) return 'barrel';
  return 'cork';
}

/**
 * Earn-rate multiplier for a tier (1 point × multiplier per NGN spent).
 */
function earnMultiplierForTier(tier = 'cork') {
  return TIER_EARN_MULTIPLIER[tier] || 1;
}

/**
 * Compute whole points earned for a spend amount at a tier. Points are whole
 * units (NGN has no sub-units); the multiplier is applied then floored.
 * @returns {number} integer points to award.
 */
function pointsForSpend(amountNGN, tier = 'cork') {
  const n = Number(amountNGN) || 0;
  if (n <= 0) return 0;
  return Math.floor(n * earnMultiplierForTier(tier));
}

/**
 * Convert redeemable points to a NGN wallet-credit amount at the fixed rate.
 * @returns {number} integer NGN (whole kobo only).
 */
function pointsToNgn(points) {
  const n = Number(points) || 0;
  if (n <= 0) return 0;
  return Math.floor(n * POINTS_TO_NGN_RATE);
}

/**
 * Roll a ledger up into headline figures: lifetime earned, redeemed, expired,
 * the net (== current balance for a consistent ledger), count and last activity.
 * Pure (no DB / no Date.now). Debits sum under `redeemed`/`expired`; earns under
 * `earned`; referrals under `referralBonus`.
 */
function summarizePlatformLoyalty(transactions = []) {
  let earned = 0;
  let redeemed = 0;
  let expired = 0;
  let referralBonus = 0;
  let lastActivityAt = null;

  for (const t of transactions) {
    const pts = t.points || 0;
    switch (t.type) {
      case 'earn':     earned += Math.abs(pts); break;
      case 'bonus':    earned += Math.abs(pts); break;
      case 'redeem':   redeemed += Math.abs(pts); break;
      case 'expiry':   expired += Math.abs(pts); break;
      case 'referral': referralBonus += Math.abs(pts); break;
      case 'adjustment':
        if (pts >= 0) earned += pts;
        else redeemed += Math.abs(pts);
        break;
      default: break;
    }

    const when = t.createdAt;
    const ts = when ? new Date(when).getTime() : NaN;
    if (!Number.isNaN(ts) && (lastActivityAt === null || ts > lastActivityAt)) {
      lastActivityAt = ts;
    }
  }

  return {
    earned,
    redeemed,
    expired,
    referralBonus,
    count: transactions.length,
    lastActivityAt: lastActivityAt === null ? null : new Date(lastActivityAt).toISOString(),
  };
}

module.exports = {
  PLATFORM_LOYALTY_TX_TYPES,
  PLATFORM_LOYALTY_REASON_MAX,
  TIER_THRESHOLDS,
  TIER_ORDER,
  TIER_EARN_MULTIPLIER,
  POINTS_TO_NGN_RATE,
  REFERRAL_BONUS_POINTS,
  validatePlatformLoyaltyTx,
  loyaltyDelta,
  affectsLifetime,
  tierFromLifetimePoints,
  earnMultiplierForTier,
  pointsForSpend,
  pointsToNgn,
  summarizePlatformLoyalty,
};