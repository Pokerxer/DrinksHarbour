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
