// Pins three latent bugs in the storefront coupon path found on 2026-09-05.
// Each was silent: a check against a field that does not exist, a write to a
// field that does not exist, and an ObjectId compared with Array.includes.
// The referral program's economics depend on all three being correct.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Coupon = require('../models/Coupon');
const couponSrc = fs.readFileSync(
  path.join(__dirname, '../controllers/order.controller.js'), 'utf8');

test('1. Coupon schema has endDate, not expiryDate', () => {
  const paths = Object.keys(Coupon.schema.paths);
  assert.ok(paths.includes('endDate'), 'endDate must exist');
  assert.ok(!paths.includes('expiryDate'),
    'expiryDate does not exist — any check against it is dead code');
});

test('2. order.controller no longer reads the non-existent expiryDate', () => {
  assert.ok(!couponSrc.includes('appliedCoupon.expiryDate'),
    'reading appliedCoupon.expiryDate is always undefined — expired coupons pass');
});

test('3. order.controller no longer writes the non-existent usedCount', () => {
  assert.ok(!couponSrc.includes('usedCount'),
    'usedCount is not on the schema — strict Mongoose drops the write silently');
});

test('4. order.controller delegates to the model validation methods', () => {
  assert.ok(couponSrc.includes('canBeUsedBy'),
    'checkout must call coupon.canBeUsedBy — it enforces allowedUsers, ' +
    'firstPurchaseOnly, usageLimitPerUser and the isValid virtual');
  assert.ok(couponSrc.includes('calculateDiscount'),
    'checkout must call coupon.calculateDiscount — it clamps fixed_amount to ' +
    'the cart total and applies maxDiscountAmount');
  assert.ok(couponSrc.includes('recordUsage'),
    'checkout must call coupon.recordUsage — it increments timesUsed correctly');
});

test('5. allowedUsers uses ObjectId-safe comparison, not Array.includes', () => {
  const src = fs.readFileSync(path.join(__dirname, '../models/Coupon.js'), 'utf8');
  assert.ok(!src.includes('this.allowedUsers.includes(userId)'),
    'Array.includes on ObjectIds is SameValueZero — false even for the owner');
  assert.ok(src.includes('this.allowedUsers.some('),
    'must compare with .some(id => id.equals(userId))');
});

test('6. canBeUsedBy enforces minimumPurchaseAmount', () => {
  const src = fs.readFileSync(path.join(__dirname, '../models/Coupon.js'), 'utf8');
  const body = src.slice(src.indexOf('canBeUsedBy'), src.indexOf('calculateDiscount'));
  assert.ok(body.includes('minimumPurchaseAmount'),
    'the ₦15,000 referral floor is enforced nowhere unless canBeUsedBy checks it');
});

// ── Behavioral tests ─────────────────────────────────────────────────────────
//
// The six tests above only assert the source text mentions the right method or
// field names — a comparison inversion (`>` written where `<` belongs) would
// still pass every one of them. These construct a real Mongoose document with
// `new Coupon({...})` and call its instance methods directly, WITHOUT calling
// `.save()` and without any database connection, so a flipped comparison or a
// reintroduced NaN actually fails the assertion.

const mongoose = require('mongoose');

function makeCoupon(overrides = {}) {
  return new Coupon({
    code: 'TESTCODE',
    name: 'Test coupon',
    discountType: 'fixed_amount',
    discountValue: 2000,
    startDate: new Date(Date.now() - 1000),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    ...overrides,
  });
}

test('7. calculateDiscount clamps a fixed_amount discount to the cart total', () => {
  const coupon = makeCoupon({ discountType: 'fixed_amount', discountValue: 2000 });
  assert.strictEqual(coupon.calculateDiscount(500), 500,
    'a ₦2,000 fixed discount on a ₦500 cart must clamp to 500, never exceed the cart');
  assert.strictEqual(coupon.calculateDiscount(5000), 2000,
    'a ₦2,000 fixed discount on a cart well above it applies in full');
});

test('8. calculateDiscount applies maxDiscountAmount to a percentage discount', () => {
  const coupon = makeCoupon({
    discountType: 'percentage',
    discountValue: 50,
    maxDiscountAmount: 1000,
  });
  assert.strictEqual(coupon.calculateDiscount(10000), 1000,
    '50% of ₦10,000 is ₦5,000, but maxDiscountAmount must cap it at ₦1,000');
  assert.strictEqual(coupon.calculateDiscount(1000), 500,
    '50% of ₦1,000 is ₦500, under the cap, so it applies uncapped');
});

test('9. calculateDiscount never returns NaN for a missing/garbage cart total', () => {
  const pct = makeCoupon({ discountType: 'percentage', discountValue: 20 });
  assert.strictEqual(pct.calculateDiscount(undefined), 0);
  assert.strictEqual(pct.calculateDiscount(NaN), 0);
  assert.strictEqual(pct.calculateDiscount('not-a-number'), 0);

  const fixed = makeCoupon({ discountType: 'fixed_amount', discountValue: 2000 });
  assert.strictEqual(fixed.calculateDiscount(undefined), 0);
  assert.strictEqual(fixed.calculateDiscount(NaN), 0);
});

test('10. canBeUsedBy rejects below the ₦15,000 floor, accepts at and above it', async () => {
  // firstPurchaseOnly: false and empty allowedUsers/excludedUsers/minimumAccountAge
  // keep this call inside canBeUsedBy's DB-free branches — see report for what the
  // method touches when those are non-empty.
  const userId = new mongoose.Types.ObjectId();
  const coupon = makeCoupon({
    minimumPurchaseAmount: 15000,
    firstPurchaseOnly: false,
    allowedUsers: [],
    excludedUsers: [],
  });

  const below = await coupon.canBeUsedBy(userId, { subtotal: 14999 });
  assert.strictEqual(below.canUse, false,
    '₦14,999 is below the ₦15,000 floor and must be rejected');

  const atFloor = await coupon.canBeUsedBy(userId, { subtotal: 15000 });
  assert.strictEqual(atFloor.canUse, true,
    '₦15,000 is exactly the floor and must be accepted — the check is strictly-less-than, not <=');

  const above = await coupon.canBeUsedBy(userId, { subtotal: 15001 });
  assert.strictEqual(above.canUse, true,
    '₦15,001 is above the floor and must be accepted');
});

test('11. canBeUsedBy fails closed on a non-finite subtotal instead of silently passing', async () => {
  const userId = new mongoose.Types.ObjectId();
  const coupon = makeCoupon({
    minimumPurchaseAmount: 15000,
    firstPurchaseOnly: false,
    allowedUsers: [],
    excludedUsers: [],
  });

  const withNaN = await coupon.canBeUsedBy(userId, { subtotal: NaN });
  assert.strictEqual(withNaN.canUse, false,
    'a non-finite subtotal must never silently clear the minimum-spend check ' +
    '(NaN < 15000 and NaN > maximum are both false, which used to fail open)');

  // Omitting subtotal entirely is the pre-existing contract relied on by callers
  // that check eligibility outside of a priced cart (findValidCoupon with no
  // options, getActiveCouponsForCustomer, canUseCoupon) — that must keep
  // skipping the spend check, not start failing closed.
  const omitted = await coupon.canBeUsedBy(userId);
  assert.strictEqual(omitted.canUse, true,
    'omitting subtotal entirely must keep skipping the spend check for existing callers');
});
