// server/controllers/loyalty.controller.js
//
// Platform-wide "Corks & Points" loyalty (the "Loyalty" account page) — the online
// counterpart to the in-store loyalty. Points are earned per NGN spent at checkout
// (wired in the order flow) and redeemed into the platform wallet at a fixed rate;
// they are NEVER redeemable for cash. The atomic mutatePlatformLoyalty service pairs
// the guarded $inc on User.loyaltyPoints (+ loyaltyLifetimePoints on earns) with the
// append-only PlatformLoyaltyTransaction ledger and recomputes the tier. Referral
// codes are issued here; the signup referral credit is applied at registration.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const User = require('../models/User');
const PlatformLoyaltyTransaction = require('../models/PlatformLoyaltyTransaction');
const { mutatePlatformLoyalty } = require('../services/platformLoyalty.service');
const {
  TIER_THRESHOLDS,
  TIER_ORDER,
  TIER_EARN_MULTIPLIER,
  POINTS_TO_NGN_RATE,
  REFERRAL_BONUS_POINTS,
  validatePlatformLoyaltyTx,
  pointsToNgn,
  tierFromLifetimePoints,
  summarizePlatformLoyalty,
} = require('../services/platformLoyalty.helpers');

const MIN_REDEEM_POINTS = 100;
const REDEEM_STEP_POINTS = 50; // redeemable in whole steps of 50

const TIER_META = {
  cork:   { name: 'Cork',   multiplier: TIER_EARN_MULTIPLIER.cork,   next: 'barrel', threshold: TIER_THRESHOLDS.barrel },
  barrel: { name: 'Barrel',  multiplier: TIER_EARN_MULTIPLIER.barrel, next: 'cellar', threshold: TIER_THRESHOLDS.cellar },
  cellar: { name: 'Cellar',  multiplier: TIER_EARN_MULTIPLIER.cellar, next: 'vault',  threshold: TIER_THRESHOLDS.vault },
  vault:  { name: 'Vault',   multiplier: TIER_EARN_MULTIPLIER.vault,  next: null,    threshold: null },
};

/**
 * @desc    Get the authenticated customer's loyalty balance, tier and progress.
 * @route   GET /api/loyalty
 * @access  Private (customer)
 */
const getLoyalty = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('loyaltyPoints loyaltyLifetimePoints loyaltyTier referralCode referralBonusEarned referredBy');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const tier = TIER_META[user.loyaltyTier] || TIER_META.cork;
  const nextThreshold = tier.threshold;
  const progress = nextThreshold == null
    ? 100
    : Math.min(100, Math.round((user.loyaltyLifetimePoints / nextThreshold) * 100));

  const recent = await PlatformLoyaltyTransaction.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  const summary = summarizePlatformLoyalty(recent);

  successResponse(res, {
    points: user.loyaltyPoints,
    lifetimePoints: user.loyaltyLifetimePoints,
    tier: user.loyaltyTier,
    tierName: tier.name,
    earnMultiplier: tier.multiplier,
    nextTier: tier.next,
    nextThreshold,
    progress,
    redeemRateNgnPerPoint: POINTS_TO_NGN_RATE,
    minRedeemPoints: MIN_REDEEM_POINTS,
    redeemStepPoints: REDEEM_STEP_POINTS,
    referralCode: user.referralCode,
    referralBonusEarned: user.referralBonusEarned,
    referredBy: user.referredBy,
    summary,
    recent: recent.map(t => ({
      _id: t._id,
      type: t.type,
      points: t.points,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      reference: t.reference,
      relatedOrder: t.relatedOrder,
      redeemedAtTenant: t.redeemedAtTenant,
      createdAt: t.createdAt,
    })),
  }, 'Loyalty status retrieved');
});

/**
 * @desc    Get paginated loyalty transaction history.
 * @route   GET /api/loyalty/transactions
 * @access  Private (customer)
 */
const getLoyaltyTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = { userId: req.user._id };
  const [total, items] = await Promise.all([
    PlatformLoyaltyTransaction.countDocuments(filter),
    PlatformLoyaltyTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'redeemedAtTenant', select: 'name slug' })
      .lean(),
  ]);

  successResponse(res, {
    items: items.map(t => ({
      _id: t._id,
      type: t.type,
      points: t.points,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      reference: t.reference,
      relatedOrder: t.relatedOrder,
      redeemedAtTenant: t.redeemedAtTenant,
      createdAt: t.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  }, 'Loyalty transactions retrieved');
});

/**
 * @desc    Redeem loyalty points into the platform wallet. Points are converted to
 *          NGN at the fixed rate; the wallet credit and points debit are applied
 *          atomically and consistently. If the wallet credit fails the points are
 *          refunded. Points are never redeemable for cash.
 * @route   POST /api/loyalty/redeem
 * @access  Private (customer)
 */
const redeemLoyaltyPoints = asyncHandler(async (req, res) => {
  const { points } = req.body;
  const n = Number(points);
  if (!Number.isInteger(n) || n < MIN_REDEEM_POINTS || n % REDEEM_STEP_POINTS !== 0) {
    return res.status(400).json({
      success: false,
      message: `Points must be a whole number ≥ ${MIN_REDEEM_POINTS} and a multiple of ${REDEEM_STEP_POINTS}`,
    });
  }

  const validated = validatePlatformLoyaltyTx({ type: 'redeem', points: n, reason: 'Redeemed to wallet' });
  if (!validated.ok) return res.status(400).json({ success: false, message: validated.message });

  const amountNgn = pointsToNgn(n);
  if (amountNgn <= 0) {
    return res.status(400).json({ success: false, message: 'Redeemable amount too small' });
  }

  // Idempotency: reject an accidental duplicate of the same redeem within a short
  // window (double-click / retry). A legitimate repeat redeem after the window is fine.
  const DUP_WINDOW_MS = 10000;
  const recent = await PlatformLoyaltyTransaction.find({
    userId: req.user._id,
    type: 'redeem',
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  if (recent.some(t => Math.abs(t.points) === n)) {
    const u = await User.findById(req.user._id).select('loyaltyPoints platformWalletBalance');
    return successResponse(res, {
      pointsRedeemed: 0,
      amountCredited: 0, // nothing was credited in THIS call — it was a duplicate
      pointsBalance: u.loyaltyPoints,
      walletBalance: u.platformWalletBalance,
      alreadyProcessed: true,
    }, 'This looks like a duplicate of a recent redemption — it was not processed again');
  }

  // Debit the points atomically.
  const debited = await mutatePlatformLoyalty({
    userId: req.user._id,
    value: validated.value,
    reference: `loyalty-redeem-${Date.now()}`,
    createdBy: req.user._id,
  });
  if (!debited.ok) return res.status(debited.status).json({ success: false, message: debited.message });

  // Credit the wallet for the equivalent NGN.
  const { mutatePlatformWallet } = require('../services/platformWallet.service');
  const credited = await mutatePlatformWallet({
    owner: { userId: req.user._id },
    value: { type: 'credit', amount: amountNgn, source: 'adjustment', reason: `${n} loyalty points redeemed` },
    reference: `loyalty-redeem-${req.user._id}-${Date.now()}`,
    createdBy: req.user._id,
  });
  if (!credited.ok) {
    // Refund the points if the wallet credit failed — never lose value.
    await mutatePlatformLoyalty({
      userId: req.user._id,
      value: { type: 'adjustment', points: n, reason: 'Reversal of failed wallet redemption' },
      createdBy: req.user._id,
    });
    return res.status(credited.status).json({ success: false, message: credited.message });
  }

  successResponse(res, {
    pointsRedeemed: n,
    amountCredited: amountNgn,
    pointsBalance: debited.balance,
    walletBalance: credited.balance,
    tier: debited.tier,
  }, `${n} points redeemed to wallet`);
});

/**
 * @desc    Generate (or return) the customer's referral code.
 * @route   POST /api/loyalty/referral-code
 * @access  Private (customer)
 */
const getOrCreateReferralCode = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('referralCode firstName lastName');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (!user.referralCode) {
    user.generateReferralCode();
    await user.save();
  }

  const referralLink = `${process.env.PLATFORM_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://drinksharbour.com'}/register?ref=${user.referralCode}`;

  successResponse(res, {
    code: user.referralCode,
    link: referralLink,
    bonusPoints: REFERRAL_BONUS_POINTS,
    displayName: user.firstName,
  }, 'Referral code ready');
});

/**
 * @desc    Apply a referral code at signup (called by the register flow, but also
 *          exposed for an already-logged-in customer who hasn't applied one yet).
 *          Awards both the referrer and the new customer a one-time bonus.
 * @route   POST /api/loyalty/apply-referral
 * @access  Private (customer)
 */
const applyReferralCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Referral code is required' });
  }

  const user = await User.findById(req.user._id).select('referredBy referralCode');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.referredBy) {
    return res.status(400).json({ success: false, message: 'A referral has already been applied to this account' });
  }

  const normalized = String(code).toUpperCase().trim();
  if (user.referralCode && user.referralCode === normalized) {
    return res.status(400).json({ success: false, message: 'You cannot refer yourself' });
  }

  const referrer = await User.findOne({ referralCode: normalized }).select('_id loyaltyPoints loyaltyLifetimePoints loyaltyTier');
  if (!referrer) return res.status(400).json({ success: false, message: 'Invalid referral code' });

  // Award the referee (the logged-in customer).
  const refereeResult = await mutatePlatformLoyalty({
    userId: user._id,
    value: { type: 'referral', points: REFERRAL_BONUS_POINTS, reason: `Referral bonus for using code ${normalized}` },
    reference: `referral-${referrer._id}-${user._id}`,
    createdBy: user._id,
  });
  if (!refereeResult.ok) return res.status(refereeResult.status).json({ success: false, message: refereeResult.message });

  // Award the referrer.
  const referrerResult = await mutatePlatformLoyalty({
    userId: referrer._id,
    value: { type: 'referral', points: REFERRAL_BONUS_POINTS, reason: `Referral bonus — ${user.email || 'a friend'} joined` },
    reference: `referral-${referrer._id}-${user._id}`,
    createdBy: user._id,
  });
  if (!referrerResult.ok) {
    // Best-effort: don't penalize the referee for a referrer-side failure.
    console.warn('Referrer bonus failed:', referrerResult.message);
  }

  user.referredBy = referrer._id;
  user.referralBonusEarned = (user.referralBonusEarned || 0) + REFERRAL_BONUS_POINTS;
  await user.save();

  successResponse(res, {
    bonusPoints: REFERRAL_BONUS_POINTS,
    pointsBalance: refereeResult.balance,
    tier: refereeResult.tier,
  }, 'Referral applied — bonus awarded!');
});

module.exports = {
  getLoyalty,
  getLoyaltyTransactions,
  redeemLoyaltyPoints,
  getOrCreateReferralCode,
  applyReferralCode,
};