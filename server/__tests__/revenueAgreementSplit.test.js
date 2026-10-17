const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitMerchandise, allocateOrderDiscount, refundRevenue } = require('../utils/revenueAgreement');
test('commission split reconciles pennies and snapshots the merchandise basis and agreed rate', () => {
  const p = splitMerchandise({ amount: 10000, quantity: 2, model: 'commission', rate: 13 });
  assert.equal(p.tenantRevenueShare, 8700);
  assert.equal(p.platformCommission, 1300);
  assert.equal(p.revenueBasisAmount, 10000);
  assert.equal(p.revenueRateAtPurchase, 13);
  assert.equal(p.vendorPriceAtPurchase, 4350);
});
test('markup keeps fixed agreed payout and refuses unfunded discounts', () => {
  assert.equal(splitMerchandise({ amount: 1400, quantity: 1, model: 'markup', rate: 25, payout: 1250 }).tenantRevenueShare, 1250);
  assert.throws(() => splitMerchandise({ amount: 1200, quantity: 1, model: 'markup', rate: 25, payout: 1250 }), /payout/i);
});
test('coupons allocate exact pennies across lines and recalculate commission only', () => {
  const items = [
    { itemSubtotal: 10000, quantity: 1, ...splitMerchandise({ amount: 10000, quantity: 1, model: 'commission', rate: 13 }) },
    { itemSubtotal: 1400, quantity: 1, ...splitMerchandise({ amount: 1400, quantity: 1, model: 'markup', rate: 25, payout: 1250 }) },
  ];
  const result = allocateOrderDiscount(items, 114);
  assert.equal(result[0].discountAmount, 100);
  assert.equal(result[0].tenantRevenueShare, 8613);
  assert.equal(result[0].platformCommission, 1287);
  assert.equal(result[1].discountAmount, 14);
  assert.equal(result[1].tenantRevenueShare, 1250);
  assert.equal(result[1].platformCommission, 136);
  assert.equal(items[0].discountAmount, undefined);
});
test('refund split uses cumulative original snapshots so partial refunds reconcile without current terms', () => {
  const item = { quantity: 3, ...splitMerchandise({ amount: 100, quantity: 3, model: 'commission', rate: 13 }) };
  const a = refundRevenue(item, 1, 0), b = refundRevenue(item, 1, 1), c = refundRevenue(item, 1, 2);
  assert.equal(a.tenantRevenueShare + b.tenantRevenueShare + c.tenantRevenueShare, 87);
  assert.equal(a.platformCommission + b.platformCommission + c.platformCommission, 13);
  assert.throws(() => refundRevenue(item, 2, 2), /quantity/i);
});
test('full refunds preserve original settlement shares while amount-only partial refunds require allocation', () => {
  const { refundSettlement } = require('../utils/revenueAgreement');
  const items = [{ quantity: 1, tenant: 'original-tenant', tenantRevenueShare: 87, platformCommission: 13 }];
  const full = refundSettlement(items, 110, 110);
  assert.equal(full.status, 'allocated');
  assert.equal(full.lines[0].tenantRevenueShare, 87);
  assert.equal(full.lines[0].platformCommission, 13);
  assert.equal(full.lines[0].tenant, 'original-tenant');
  assert.equal(refundSettlement(items, 50, 110).status, 'needs_review');
});
