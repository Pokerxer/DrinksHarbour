// Footer adjustments (Odoo-style quotation footer): shipping fee, coupon
// codes, planned loyalty redemption. All offline — the coupon lookup is
// injected, and applyEdit's engines/FK checks no-op without a DB connection.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

function baseOrder(extra = {}) {
  return {
    tenant: oid(),
    items: [],
    subtotal: 10000,
    discountTotal: 1000,
    promotionTotal: 500,
    taxTotal: 850, // 10% of untaxed 8500
    total: 9350,
    couponDiscount: 0,
    shippingFee: 0,
    createdAt: new Date(),
    ...extra,
  };
}

test('refreshOrderTotal assembles untaxed + tax − coupon + shipping, floored at 0', () => {
  const so = baseOrder({ couponDiscount: 350, shippingFee: 2000 });
  svc.refreshOrderTotal(so);
  assert.strictEqual(so.total, 8500 + 850 - 350 + 2000);

  // Coupon larger than the pre-shipping total clamps to 0 before shipping is added.
  const so2 = baseOrder({ couponDiscount: 999999, shippingFee: 1500 });
  svc.refreshOrderTotal(so2);
  assert.strictEqual(so2.total, 1500);
});

test('applyEdit passes shippingFee and plannedRedeemPoints through and re-totals', async () => {
  const so = baseOrder();
  await svc.applyEdit(so, { shippingFee: 2500, plannedRedeemPoints: 120.7 });
  assert.strictEqual(so.shippingFee, 2500);
  assert.strictEqual(so.plannedRedeemPoints, 121);
  assert.strictEqual(so.total, 8500 + 850 + 2500);
});

test('applyCouponToOrder resolves a percentage promotion against untaxed+tax', async () => {
  const so = baseOrder();
  const findByCode = async (tenantId, code) => {
    assert.strictEqual(code, 'SAVE10');
    return { code: 'save10', name: 'Save 10%', discountType: 'percentage', discountValue: 10 };
  };
  await svc.applyCouponToOrder(so, 'SAVE10', { findByCode });
  assert.strictEqual(so.couponCode, 'SAVE10');
  assert.strictEqual(so.couponName, 'Save 10%');
  assert.strictEqual(so.couponDiscount, Math.round((8500 + 850) * 0.1));
  assert.strictEqual(so.total, 8500 + 850 - so.couponDiscount);
});

test('applyCouponToOrder honors fixed value, maxDiscountAmount cap, and base clamp', async () => {
  const so = baseOrder();
  const promo = { code: 'FLAT', name: 'Flat', discountType: 'fixed', discountValue: 5000, maxDiscountAmount: 3000 };
  await svc.applyCouponToOrder(so, 'FLAT', { findByCode: async () => promo });
  assert.strictEqual(so.couponDiscount, 3000);

  const so2 = baseOrder({ subtotal: 100, discountTotal: 0, promotionTotal: 0, taxTotal: 0 });
  const promo2 = { code: 'BIG', name: 'Big', discountType: 'fixed', discountValue: 5000 };
  await svc.applyCouponToOrder(so2, 'BIG', { findByCode: async () => promo2 });
  assert.strictEqual(so2.couponDiscount, 100);
  assert.strictEqual(so2.total, 0);
});

test('applyCouponToOrder rejects unknown and expired codes', async () => {
  const so = baseOrder();
  await assert.rejects(
    () => svc.applyCouponToOrder(so, 'NOPE', { findByCode: async () => null }),
    /Invalid or inactive/
  );
  const expired = { code: 'OLD', discountType: 'fixed', discountValue: 100, endDate: new Date(Date.now() - 86400000) };
  await assert.rejects(
    () => svc.applyCouponToOrder(so, 'OLD', { findByCode: async () => expired }),
    /expired/
  );
});

test('applyCouponToOrder with a falsy code clears the coupon and re-totals', async () => {
  const so = baseOrder({ couponCode: 'X', couponName: 'X', couponDiscount: 500 });
  await svc.applyCouponToOrder(so, '');
  assert.strictEqual(so.couponCode, '');
  assert.strictEqual(so.couponDiscount, 0);
  assert.strictEqual(so.total, 9350);
});
