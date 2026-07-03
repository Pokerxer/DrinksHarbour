// Unit tests for the platform-wide (ecommerce) "Corks & Points" loyalty rules.
// Pure, Mongo-free — mirrors platformWallet.helpers.test.js in style.

const test = require('node:test');
const assert = require('node:assert');
const {
  PLATFORM_LOYALTY_TX_TYPES,
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
} = require('../services/platformLoyalty.helpers');

test('enums expose the platform loyalty tx types and tiers', () => {
  assert.deepStrictEqual(PLATFORM_LOYALTY_TX_TYPES, ['earn', 'redeem', 'adjustment', 'bonus', 'expiry', 'referral']);
  assert.deepStrictEqual(TIER_ORDER, ['cork', 'barrel', 'cellar', 'vault']);
  assert.ok(TIER_THRESHOLDS.cork === 0 && TIER_THRESHOLDS.vault > TIER_THRESHOLDS.cellar);
});

test('validatePlatformLoyaltyTx accepts a valid earn', () => {
  const r = validatePlatformLoyaltyTx({ type: 'earn', points: 120, reason: '  order spend ' });
  assert.deepStrictEqual(r, { ok: true, value: { type: 'earn', points: 120, reason: 'order spend' } });
});

test('validatePlatformLoyaltyTx rejects bad type / points', () => {
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'x', points: 1 }).ok, false);
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'earn', points: 0 }).ok, false);
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'earn', points: 1.5 }).ok, false);
});

test('validatePlatformLoyaltyTx allows a signed adjustment', () => {
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'adjustment', points: -50 }).ok, true);
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'adjustment', points: 50 }).ok, true);
});

test('validatePlatformLoyaltyTx caps reason length', () => {
  assert.strictEqual(validatePlatformLoyaltyTx({ type: 'earn', points: 1, reason: 'a'.repeat(281) }).ok, false);
});

test('loyaltyDelta subtracts for redeem/expiry, signs adjustment, adds otherwise', () => {
  assert.strictEqual(loyaltyDelta('redeem', 50), -50);
  assert.strictEqual(loyaltyDelta('expiry', 30), -30);
  assert.strictEqual(loyaltyDelta('earn', 100), 100);
  assert.strictEqual(loyaltyDelta('referral', REFERRAL_BONUS_POINTS), REFERRAL_BONUS_POINTS);
  assert.strictEqual(loyaltyDelta('adjustment', -25), -25);
  assert.strictEqual(loyaltyDelta('adjustment', 25), 25);
  // magnitude enforced for negative-direction types
  assert.strictEqual(loyaltyDelta('redeem', -50), -50);
});

test('affectsLifetime flags only earn/bonus/referral', () => {
  assert.strictEqual(affectsLifetime('earn'), true);
  assert.strictEqual(affectsLifetime('bonus'), true);
  assert.strictEqual(affectsLifetime('referral'), true);
  assert.strictEqual(affectsLifetime('redeem'), false);
  assert.strictEqual(affectsLifetime('expiry'), false);
  assert.strictEqual(affectsLifetime('adjustment'), false);
});

test('tierFromLifetimePoints walks the ladder', () => {
  assert.strictEqual(tierFromLifetimePoints(0), 'cork');
  assert.strictEqual(tierFromLifetimePoints(2499), 'cork');
  assert.strictEqual(tierFromLifetimePoints(TIER_THRESHOLDS.barrel), 'barrel');
  assert.strictEqual(tierFromLifetimePoints(TIER_THRESHOLDS.cellar), 'cellar');
  assert.strictEqual(tierFromLifetimePoints(TIER_THRESHOLDS.vault), 'vault');
  assert.strictEqual(tierFromLifetimePoints(1e9), 'vault');
});

test('earnMultiplierForTier and pointsForSpend scale per tier', () => {
  assert.strictEqual(earnMultiplierForTier('cork'), 1);
  assert.strictEqual(earnMultiplierForTier('vault'), TIER_EARN_MULTIPLIER.vault);
  // 10,000 NGN at cork = 10,000 pts; at vault = 15,000 pts (floored)
  assert.strictEqual(pointsForSpend(10000, 'cork'), 10000);
  assert.strictEqual(pointsForSpend(10000, 'vault'), Math.floor(10000 * TIER_EARN_MULTIPLIER.vault));
  assert.strictEqual(pointsForSpend(0, 'cork'), 0);
  assert.strictEqual(pointsForSpend(-5, 'cork'), 0);
});

test('pointsToNgn converts at the fixed rate, floors to whole NGN', () => {
  assert.strictEqual(pointsToNgn(100), Math.floor(100 * POINTS_TO_NGN_RATE));
  assert.strictEqual(pointsToNgn(0), 0);
  assert.strictEqual(pointsToNgn(-10), 0);
  // 250 pts at 0.5 = 125 NGN exactly
  assert.strictEqual(pointsToNgn(250), 125);
});

test('summarizePlatformLoyalty rolls up earn/redeem/expiry/referral and last activity', () => {
  const txs = [
    { type: 'earn', points: 100, createdAt: '2025-01-01T00:00:00Z' },
    { type: 'redeem', points: 50, createdAt: '2025-02-01T00:00:00Z' },
    { type: 'expiry', points: 20, createdAt: '2025-03-01T00:00:00Z' },
    { type: 'referral', points: REFERRAL_BONUS_POINTS, createdAt: '2025-04-01T00:00:00Z' },
  ];
  const s = summarizePlatformLoyalty(txs);
  assert.strictEqual(s.earned, 100);
  assert.strictEqual(s.redeemed, 50);
  assert.strictEqual(s.expired, 20);
  assert.strictEqual(s.referralBonus, REFERRAL_BONUS_POINTS);
  assert.strictEqual(s.count, 4);
  assert.strictEqual(s.lastActivityAt, '2025-04-01T00:00:00.000Z');
});

test('summarizePlatformLoyalty handles an empty ledger', () => {
  const s = summarizePlatformLoyalty([]);
  assert.strictEqual(s.earned, 0);
  assert.strictEqual(s.redeemed, 0);
  assert.strictEqual(s.lastActivityAt, null);
});