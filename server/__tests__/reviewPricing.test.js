const { test } = require('node:test');
const assert = require('node:assert');

const {
  calcPlatformCostPrice,
  calcPlatformSellingPrice,
  calculateSubProductPricing,
  calculateSizePricing,
  backCalcStoredPrice,
} = require('../utils/pricing');

// Recompute the full forward chain the way the review drawer / storefront does
const forwardPrice = (stored, ctx) => {
  const platformCost =
    ctx.revenueModel === 'markup'
      ? calcPlatformCostPrice(stored, 0, 'markup', ctx.markupPct, ctx.commissionPct)
      : calcPlatformCostPrice(0, stored, 'commission', ctx.markupPct, ctx.commissionPct);
  return calcPlatformSellingPrice(platformCost, ctx.platformMarkupPct, ctx.productDiscount);
};

test('markup model: platform cost and selling follow cost × (1+markup) × (1+platformMarkup), rounded up to 100', () => {
  const cost = calcPlatformCostPrice(1000, 0, 'markup', 25, 12);
  assert.strictEqual(cost, 1250);
  // 1250 × 1.15 = 1437.5 → rounds UP to the nearest 100
  assert.strictEqual(calcPlatformSellingPrice(cost, 15), 1500);
});

test('platform selling price always rounds up to the nearest 100', () => {
  assert.strictEqual(calcPlatformSellingPrice(1000, 13), 1200); // 1130 → 1200
  assert.strictEqual(calcPlatformSellingPrice(1000, 20), 1200); // exact 1200 stays
});

test('undercut: platform price lands just below the tenant store price', () => {
  // commission 10% on ₦2000 → platform cost 1800; ×1.15 = 2070 → 2100 ≥ tenant 2000
  const cost = calcPlatformCostPrice(0, 2000, 'commission', 25, 10);
  const selling = calcPlatformSellingPrice(cost, 15, null, { tenantStorePrice: 2000 });
  assert.strictEqual(selling, 1900); // nearest 100 below tenant price, gap ≤ 100
});

test('undercut is skipped when an admin override pct is in effect', () => {
  const cost = calcPlatformCostPrice(0, 2000, 'commission', 25, 10); // 1800
  const selling = calcPlatformSellingPrice(cost, 15, null, {
    tenantStorePrice: 2000,
    platformMarkupOverridePct: 20,
  });
  assert.strictEqual(selling, 2200); // 1800 × 1.2 = 2160 → 2200, no undercut
});

test('admin override pct survives a tenant cost change (auto-recalculated selling)', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, platformMarkupOverridePct: 30 };

  const before = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(before.platformCostPrice, 1250);
  assert.strictEqual(before.platformSellingPrice, 1700); // 1250 × 1.3 = 1625 → 1700
  assert.strictEqual(before.isPlatformMarkupOverridden, true);

  // Tenant raises their cost — same override % is reapplied automatically
  size.costPrice = 1200;
  const after = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(after.platformCostPrice, 1500);
  assert.strictEqual(after.platformSellingPrice, 2000); // 1500 × 1.3 = 1950 → 2000
});

test('commission model: platform cost = tenant price × (1 − commission)', () => {
  const cost = calcPlatformCostPrice(0, 2000, 'commission', 25, 10);
  assert.strictEqual(cost, 1800);
});

test('size pricing falls back to sub-product values when size price is 0', () => {
  const pricing = calculateSizePricing(
    { costPrice: 0, sellingPrice: 0 },
    { platformMarkup: 15 },
    { revenueModel: 'markup', markupPercentage: 25 },
    1000,
    1600
  );
  assert.strictEqual(pricing.costPrice, 1000);
  assert.strictEqual(pricing.tenantSellingPrice, 1600);
  assert.strictEqual(pricing.platformCostPrice, 1250);
});

test('tenantReceives under commission is tenant price minus commission, even with product discount', () => {
  const pricing = calculateSubProductPricing(
    { costPrice: 0, baseSellingPrice: 2000 },
    {
      platformMarkup: 15,
      platformDiscount: { value: 10, type: 'percentage' },
    },
    { revenueModel: 'commission', commissionPercentage: 12 }
  );
  assert.strictEqual(pricing.tenantReceives, 1760); // 2000 × 0.88
});

test('backCalc roundtrip — markup, no discount', () => {
  const ctx = { revenueModel: 'markup', markupPct: 25, commissionPct: 12, platformMarkupPct: 15, productDiscount: null };
  const stored = backCalcStoredPrice(253500, ctx);
  // forward now rounds UP to the nearest 100, so the roundtrip lands within one step
  assert.ok(Math.abs(forwardPrice(stored, ctx) - 253500) <= 100);
});

test('backCalc roundtrip — commission, no discount', () => {
  const ctx = { revenueModel: 'commission', markupPct: 25, commissionPct: 12, platformMarkupPct: 15, productDiscount: null };
  const stored = backCalcStoredPrice(50000, ctx);
  assert.ok(Math.abs(forwardPrice(stored, ctx) - 50000) <= 100);
});

test('backCalc roundtrip — markup with active percentage product discount', () => {
  const ctx = {
    revenueModel: 'markup',
    markupPct: 25,
    commissionPct: 12,
    platformMarkupPct: 15,
    productDiscount: { value: 10, type: 'percentage' },
  };
  const stored = backCalcStoredPrice(90000, ctx);
  assert.ok(Math.abs(forwardPrice(stored, ctx) - 90000) <= 100);
});

test('backCalc roundtrip — commission with active fixed product discount', () => {
  const ctx = {
    revenueModel: 'commission',
    markupPct: 25,
    commissionPct: 12,
    platformMarkupPct: 15,
    productDiscount: { value: 500, type: 'fixed' },
  };
  const stored = backCalcStoredPrice(25000, ctx);
  assert.ok(Math.abs(forwardPrice(stored, ctx) - 25000) <= 100);
});

test('backCalc treats platform_markup revenue model as markup', () => {
  const asMarkup = backCalcStoredPrice(10000, { revenueModel: 'markup', markupPct: 25, platformMarkupPct: 15 });
  const asPlatformMarkup = backCalcStoredPrice(10000, { revenueModel: 'platform_markup', markupPct: 25, platformMarkupPct: 15 });
  assert.strictEqual(asMarkup, asPlatformMarkup);
});
