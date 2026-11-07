const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateSizePricing, calculateSubProductPricing, applySubProductSale, calcPlatformCostPrice } = require('../utils/pricing');
const { splitMerchandise, allocateOrderDiscount, refundRevenue } = require('../utils/revenueAgreement');
const tenant = { revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: 20, markupPercentage: 40, commissionPercentage: 12, packMarkupPercentage: 5 };
const product = { platformMarkup: 80 };
const listing = { baseSellingPrice: 100000, costPrice: 90000 };
test('selling-price markup adds default to retail without commission, cost markup or undercut', () => {
  const p = calculateSubProductPricing(listing, product, tenant);
  assert.equal(p.finalPrice, 120000);
  assert.equal(p.platformCostPrice, 100000);
  assert.equal(p.tenantReceives, 100000);
  assert.equal(p.platformMargin, 20000);
  assert.equal(p.platformMarkupPct, 20);
  assert.equal(calcPlatformCostPrice(90000, 100000, tenant.revenueModel, 40, 12, 50000), 100000);
});
test('percentage override survives default, cost and retail changes', () => {
  const sp = { ...listing, sellingPriceMarkupOverridePct: 25 };
  assert.equal(calculateSubProductPricing(sp, product, tenant).finalPrice, 125000);
  assert.equal(calculateSubProductPricing({ ...sp, costPrice: 1, baseSellingPrice: 120000 }, product, { ...tenant, sellingPriceMarkupPercentage: 30 }).finalPrice, 150000);
  assert.equal(calculateSubProductPricing(listing, product, { ...tenant, sellingPriceMarkupPercentage: 30 }).finalPrice, 130000);
});
test('explicit zero override and size fallback use same agreement without invented pack discount', () => {
  const p = calculateSizePricing({ sellingPrice: 100000, costPrice: 1, wholesalePrice: 2, unitsPerPack: 6, sellingPriceMarkupOverridePct: 0 }, product, tenant);
  assert.equal(p.finalPrice, 100000);
  assert.equal(p.platformCostPrice, 100000);
  assert.equal(p.packUnitPrice, null);
  assert.equal(calculateSizePricing({ sellingPrice: 0 }, product, tenant, 90000, 100000).finalPrice, 120000);
});
test('invalid retail is unpurchasable and invalid rates are rejected', () => {
  for (const base of [0, -1, NaN, Infinity]) assert.equal(calculateSubProductPricing({ ...listing, baseSellingPrice: base }, product, tenant).finalPrice, 0);
  for (const pct of [-1, NaN, Infinity, 501]) assert.throws(() => calculateSubProductPricing(listing, product, { ...tenant, sellingPriceMarkupPercentage: pct }), /percentage/i);
});
test('discounts reduce platform share and over-discount checkout is rejected', () => {
  const p = calculateSubProductPricing(listing, { ...product, platformDiscount: { type: 'percentage', value: 5 } }, tenant);
  assert.equal(p.finalPrice, 114000);
  const sale = applySubProductSale(p, { isOnSale: true, saleType: 'fixed', saleDiscountValue: 4000 });
  assert.equal(sale.finalPrice, 110000);
  assert.equal(sale.platformCostPrice, 100000);
  assert.equal(sale.platformMargin, 10000);
  assert.throws(() => splitMerchandise({ amount: 99000, model: tenant.revenueModel, rate: 20, payout: 100000 }), /payout/i);
});
test('coupon and partial refund use immutable payout snapshots', () => {
  const split = splitMerchandise({ amount: 240000, quantity: 2, model: tenant.revenueModel, rate: 20, payout: 100000 });
  assert.equal(split.tenantRevenueShare, 200000);
  assert.equal(split.platformCommission, 40000);
  const [item] = allocateOrderDiscount([{ ...split, quantity: 2, itemSubtotal: 240000 }], 10000);
  assert.equal(item.tenantRevenueShare, 200000);
  assert.equal(item.platformCommission, 30000);
  assert.deepEqual(refundRevenue(item, 1), { tenantRevenueShare: 100000, platformCommission: 15000 });
  assert.equal(item.revenueRateAtPurchase, 20);
});
test('tenant retail edits never manufacture inherited percentage overrides', () => {
  const { preserveEffectivePlatformMarkupOnCostChange } = require('../services/subproduct.service');
  const row = { sellingPrice: 100000, costPrice: 90000 };
  preserveEffectivePlatformMarkupOnCostChange(row, product, tenant, 0, 0);
  assert.equal(row.platformMarkupOverridePct, undefined);
  assert.equal(row.sellingPriceMarkupOverridePct, undefined);
});
test('tenant configuration roundtrips the new terms and rejects invalid percentage input', () => {
  const { buildTenantData } = require('../controllers/tenant.controller');
  const Tenant = require('../models/Tenant');
  const data = buildTenantData({ revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: '20' }, true);
  const doc = new Tenant(data);
  assert.equal(doc.revenueModel, 'selling_price_markup');
  assert.equal(doc.sellingPriceMarkupPercentage, 20);
  assert.equal(buildTenantData({ sellingPriceMarkupPercentage: '0' }, true).sellingPriceMarkupPercentage, 0);
  for (const rate of ['abc', -1, 501, Infinity]) assert.throws(() => buildTenantData({ sellingPriceMarkupPercentage: rate }, true), /percentage/i);
});
test('active catalogue discounts expose the same preview metadata as existing revenue models', () => {
  const active = { ...product, platformDiscount: { type: 'percentage', value: 5 } };
  assert.equal(calculateSubProductPricing(listing, active, tenant).productDiscount.active, true);
  const expired = { ...product, platformDiscount: { type: 'percentage', value: 5, end: '2000-01-01' } };
  assert.equal(calculateSubProductPricing(listing, expired, tenant).productDiscount, null);
});
