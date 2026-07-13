const { test } = require('node:test');
const assert = require('node:assert');

const {
  resolveRevenueRates,
  calculateSizePricing,
  calculateSubProductPricing,
} = require('../utils/pricing');

// ─────────────────────────────────────────────────────────────────
// resolveRevenueRates — picks pack rates when a size is a multi-pack
// ─────────────────────────────────────────────────────────────────

test('single unit resolves to the normal tenant rates', () => {
  const tenant = {
    markupPercentage: 40,
    commissionPercentage: 12,
    packMarkupPercentage: 25,
    packCommissionPercentage: 8,
  };
  const rates = resolveRevenueRates(tenant, 1);
  assert.strictEqual(rates.markupPct, 40);
  assert.strictEqual(rates.commissionPct, 12);
  assert.strictEqual(rates.isPackRate, false);
});

test('pack size resolves to the tenant pack rates', () => {
  const tenant = {
    markupPercentage: 40,
    commissionPercentage: 12,
    packMarkupPercentage: 25,
    packCommissionPercentage: 8,
  };
  const rates = resolveRevenueRates(tenant, 6);
  assert.strictEqual(rates.markupPct, 25);
  assert.strictEqual(rates.commissionPct, 8);
  assert.strictEqual(rates.isPackRate, true);
});

test('unconfigured pack markup defaults to 10%; commission falls back to the normal rate', () => {
  const tenant = { markupPercentage: 40, commissionPercentage: 12 };
  const rates = resolveRevenueRates(tenant, 12);
  assert.strictEqual(rates.markupPct, 10);
  assert.strictEqual(rates.commissionPct, 12);
});

test('packRateMinUnits controls when the pack rate kicks in', () => {
  const tenant = {
    markupPercentage: 40,
    packMarkupPercentage: 25,
    packRateMinUnits: 6,
  };
  assert.strictEqual(resolveRevenueRates(tenant, 4).markupPct, 40);
  assert.strictEqual(resolveRevenueRates(tenant, 6).markupPct, 25);
  assert.strictEqual(resolveRevenueRates(tenant, 24).markupPct, 25);
});

test('threshold defaults to 2 units when packRateMinUnits is unset', () => {
  const tenant = { markupPercentage: 40, packMarkupPercentage: 25 };
  assert.strictEqual(resolveRevenueRates(tenant, 1).markupPct, 40);
  assert.strictEqual(resolveRevenueRates(tenant, 2).markupPct, 25);
});

test('missing tenant and unitsPerPack fall back to platform defaults', () => {
  const rates = resolveRevenueRates(null);
  assert.strictEqual(rates.markupPct, 25);
  assert.strictEqual(rates.commissionPct, 12);
  assert.strictEqual(rates.isPackRate, false);
});

// ─────────────────────────────────────────────────────────────────
// calculateSizePricing — pack sizes priced with the pack rate
// ─────────────────────────────────────────────────────────────────

test('markup model: pack chain runs per unit, totals are × unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  // costPrice is the PER-UNIT supplier cost of the pack size
  const size = { costPrice: 1000, sellingPrice: 0, unitsPerPack: 12 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.unitPlatformCostPrice, 1250); // 1000 × 1.25
  assert.strictEqual(pricing.unitPlatformSellingPrice, 1500); // 1250 × 1.15 = 1437.5 → 1500
  assert.strictEqual(pricing.platformCostPrice, 15000); // 1250 × 12
  assert.strictEqual(pricing.platformSellingPrice, 18000); // 1500 × 12
  assert.strictEqual(pricing.platformMargin, 3000);
  assert.strictEqual(pricing.markupPct, 25);
  assert.strictEqual(pricing.isPackRate, true);
});

test('markup model: single bottle of same tenant keeps the normal markup', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, unitsPerPack: 1 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1400); // 1000 × 1.40
  assert.strictEqual(pricing.markupPct, 40);
  assert.strictEqual(pricing.isPackRate, false);
});

test('commission model: pack commission applies per unit, totals × unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const tenant = {
    revenueModel: 'commission',
    commissionPercentage: 12,
    packCommissionPercentage: 8,
  };
  // sellingPrice is the PER-UNIT tenant price of the pack size; no undercut
  // (2530 → round-up 2600 stays above 2000? no — undercut drops below tenant
  // price, so expected unit selling is 1900)
  const size = { costPrice: 0, sellingPrice: 2000, unitsPerPack: 12 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.unitPlatformCostPrice, 1840); // 2000 × 0.92
  // 1840 × 1.15 = 2116 → 2200 ≥ tenant 2000 → undercut to 1900 (existing rule)
  assert.strictEqual(pricing.unitPlatformSellingPrice, 1900);
  assert.strictEqual(pricing.platformCostPrice, 22080); // 1840 × 12
  assert.strictEqual(pricing.platformSellingPrice, 22800); // 1900 × 12
  assert.strictEqual(pricing.commissionPct, 8);
  assert.strictEqual(pricing.isPackRate, true);
});

test('per-size admin override still wins over the platform markup on packs', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = {
    costPrice: 1000,
    sellingPrice: 0,
    unitsPerPack: 12,
    platformMarkupOverridePct: 30,
  };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  // Tenant stage still uses the pack markup per unit; override replaces only
  // the platform stage, then the total is × unitsPerPack
  assert.strictEqual(pricing.unitPlatformCostPrice, 1250);
  assert.strictEqual(pricing.unitPlatformSellingPrice, 1700); // 1250 × 1.3 = 1625 → 1700
  assert.strictEqual(pricing.platformCostPrice, 15000);
  assert.strictEqual(pricing.platformSellingPrice, 20400); // 1700 × 12
  assert.strictEqual(pricing.isPlatformMarkupOverridden, true);
});

test('single-unit sizes are untouched by the pack multiplier', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, unitsPerPack: 1 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1250);
  assert.strictEqual(pricing.platformSellingPrice, 1500);
  assert.strictEqual(pricing.unitPlatformSellingPrice, 1500);
});

// ─────────────────────────────────────────────────────────────────
// calculateSubProductPricing — no-variant path has no pack concept
// ─────────────────────────────────────────────────────────────────

test('no-variant path keeps the normal markup even when pack rates exist', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const subProduct = { costPrice: 1000, baseSellingPrice: 0 };

  const pricing = calculateSubProductPricing(subProduct, product, tenant);
  assert.strictEqual(pricing.platformCostPrice, 1400);
  assert.strictEqual(pricing.markupPct, 40);
});
