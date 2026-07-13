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

test('pack rates fall back to normal rates when not configured', () => {
  const tenant = { markupPercentage: 40, commissionPercentage: 12 };
  const rates = resolveRevenueRates(tenant, 12);
  assert.strictEqual(rates.markupPct, 40);
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

test('markup model: 12-pack is priced with the pack markup', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = { costPrice: 12000, sellingPrice: 0, unitsPerPack: 12 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 15000); // 12000 × 1.25
  assert.strictEqual(pricing.platformSellingPrice, 17300); // 15000 × 1.15 = 17250 → 17300
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

test('commission model: pack size uses the pack commission', () => {
  const product = { platformMarkup: 15 };
  const tenant = {
    revenueModel: 'commission',
    commissionPercentage: 12,
    packCommissionPercentage: 8,
  };
  const size = { costPrice: 0, sellingPrice: 24000, unitsPerPack: 12 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 22080); // 24000 × 0.92
  assert.strictEqual(pricing.commissionPct, 8);
  assert.strictEqual(pricing.isPackRate, true);
});

test('per-size admin override still wins over the platform markup on packs', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = {
    costPrice: 12000,
    sellingPrice: 0,
    unitsPerPack: 12,
    platformMarkupOverridePct: 30,
  };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  // Tenant stage still uses the pack markup; override replaces only the platform stage
  assert.strictEqual(pricing.platformCostPrice, 15000);
  assert.strictEqual(pricing.platformSellingPrice, 19500); // 15000 × 1.3
  assert.strictEqual(pricing.isPlatformMarkupOverridden, true);
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
