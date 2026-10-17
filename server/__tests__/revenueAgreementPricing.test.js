const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateSizePricing, calculateSubProductPricing, applySubProductSale, resolveEffectiveUnitPrice } = require('../utils/pricing');
const tenant = { revenueModel: 'commission', commissionPercentage: 13 };
const size = { costPrice: 6000, sellingPrice: 10000, unitsPerPack: 6 };
test('commission uses retail merchandise price with no second platform markup', () => {
  const p = calculateSizePricing(size, { platformMarkup: 80 }, tenant);
  assert.equal(p.finalPrice, 10000);
  assert.equal(p.platformCostPrice, 8700);
  assert.equal(p.platformMargin, 1300);
});
test('commission payout follows catalogue and listing discounts, not retail list price', () => {
  const p = calculateSizePricing(size, { platformMarkup: 80, platformDiscount: { value: 10, type: 'percentage' } }, tenant);
  const sale = applySubProductSale(p, { isOnSale: true, saleType: 'fixed', saleDiscountValue: 1000 });
  assert.equal(p.finalPrice, 9000);
  assert.equal(p.platformCostPrice, 7830);
  assert.equal(sale.finalPrice, 8000);
  assert.equal(sale.platformCostPrice, 6960);
  assert.equal(sale.platformMargin, 1040);
});
test('base and size explicit commission prices never change retail price or agreement rate', () => {
  const p = calculateSubProductPricing({ costPrice: 6000, baseSellingPrice: 10000, commissionPriceOverride: 9000, platformMarkupOverridePct: 90 }, { platformMarkup: 50 }, tenant);
  assert.equal(p.finalPrice, 9000);
  assert.equal(p.platformCostPrice, 7830);
  assert.equal(p.commissionPct, 13);
});
test('commission pack is an explicit cheaper offer and payout uses the pack rate only when earned', () => {
  const p = calculateSizePricing({ ...size, packCommissionPriceOverride: 9000 }, {}, { ...tenant, packCommissionPercentage: 10 });
  assert.equal(resolveEffectiveUnitPrice(p, 5), 10000);
  assert.equal(resolveEffectiveUnitPrice(p, 6), 9000);
  assert.equal(p.packPlatformCostPrice, 8100);
  assert.equal(p.packCommissionPct, 10);
});
test('commission never treats a missing or invalid contractual rate as an extra markup', () => {
  assert.throws(() => calculateSizePricing(size, {}, { revenueModel: 'commission', commissionPercentage: 101 }), /commission/i);
  const zero = calculateSizePricing(size, { platformMarkup: 50 }, { revenueModel: 'commission', commissionPercentage: 0 });
  assert.equal(zero.platformCostPrice, 10000);
  assert.equal(zero.platformMargin, 0);
});
test('commission cost changes do not manufacture platform markup overrides', () => {
  const { preserveEffectivePlatformMarkupOnCostChange } = require('../services/subproduct.service');
  const row = { ...size };
  preserveEffectivePlatformMarkupOnCostChange(row, { platformMarkup: 50 }, tenant, 0, 0);
  assert.equal(row.platformMarkupOverridePct, undefined);
});
test('commission cost helper uses the same penny remainder as the settlement snapshot', () => {
  const { calcPlatformCostPrice } = require('../utils/pricing');
  assert.equal(calcPlatformCostPrice(0, 100, 'commission', 25, 13.335), 86.66);
});
