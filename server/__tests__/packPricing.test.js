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
// calculateSizePricing — single-variant path
// ─────────────────────────────────────────────────────────────────

test('markup model: single bottle of same tenant keeps the normal markup', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, unitsPerPack: 1 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1400); // 1000 × 1.40
  assert.strictEqual(pricing.markupPct, 40);
});

test('per-size admin override still wins over the platform markup', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 40, packMarkupPercentage: 25 };
  const size = {
    costPrice: 12000,
    sellingPrice: 0,
    unitsPerPack: 12,
    platformMarkupOverridePct: 30,
  };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
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

// ─────────────────────────────────────────────────────────────────
// Quantity-triggered pack pricing (Phase 2)
// ─────────────────────────────────────────────────────────────────
const { resolveLineRates, resolveEffectiveUnitPrice } = require('../utils/pricing');

const packTenant = {
  revenueModel: 'markup',
  markupPercentage: 15,
  commissionPercentage: 12,
  packMarkupPercentage: 10,
  packRateMinUnits: 2,
};

test('resolveLineRates: below threshold quantity uses normal rates', () => {
  const size = { unitsPerPack: 6 };
  const rates = resolveLineRates(packTenant, size, 5);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, false);
});

test('resolveLineRates: at threshold quantity uses pack rates for the whole line', () => {
  const size = { unitsPerPack: 6 };
  assert.strictEqual(resolveLineRates(packTenant, size, 6).markupPct, 10);
  assert.strictEqual(resolveLineRates(packTenant, size, 6).isPackRate, true);
  // 8 units: still whole-line pack rate
  assert.strictEqual(resolveLineRates(packTenant, size, 8).markupPct, 10);
});

test('resolveLineRates: ineligible size (unitsPerPack 1) never gets pack rates', () => {
  const rates = resolveLineRates(packTenant, { unitsPerPack: 1 }, 50);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, false);
});

test('resolveLineRates: tenant without pack rates stays at normal rates', () => {
  const tenant = { markupPercentage: 15, commissionPercentage: 12 };
  const rates = resolveLineRates(tenant, { unitsPerPack: 6 }, 6);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, false); // rates fell back to normal — not a pack rate
});

test('calculateSizePricing: headline finalPrice uses NORMAL rates regardless of unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };
  const single = calculateSizePricing({ ...size, unitsPerPack: 1 }, product, packTenant, 0, 0);
  const packEligible = calculateSizePricing(size, product, packTenant, 0, 0);
  assert.strictEqual(packEligible.finalPrice, single.finalPrice);
  assert.strictEqual(packEligible.markupPct, 15);
});

test('calculateSizePricing: pack-eligible size publishes packUnitPrice/packThreshold/packSavingsPct', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };
  const pricing = calculateSizePricing(size, product, packTenant, 0, 0);
  // normal: 10000×1.15×1.15 = 13225 → 13300; pack: 10000×1.10×1.15 = 12650 → 12700
  assert.strictEqual(pricing.packThreshold, 6);
  assert.ok(pricing.packUnitPrice > 0);
  assert.ok(pricing.packUnitPrice < pricing.finalPrice);
  assert.ok(pricing.packSavingsPct >= 1);
});

test('calculateSizePricing: pack fields are null when the size is not eligible', () => {
  const product = { platformMarkup: 15 };
  const pricing = calculateSizePricing({ costPrice: 10000, sellingPrice: 0, unitsPerPack: 1 }, product, packTenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
  assert.strictEqual(pricing.packThreshold, null);
  assert.strictEqual(pricing.packSavingsPct, null);
});

test('calculateSizePricing: pack fields suppressed when tenant has no pack rates (no real saving)', () => {
  const tenant = { revenueModel: 'markup', markupPercentage: 15 };
  const product = { platformMarkup: 15 };
  const pricing = calculateSizePricing({ costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 }, product, tenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
});

test('calculateSizePricing: pack fields suppressed when maxOrderQuantity < unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6, maxOrderQuantity: 4 };
  const pricing = calculateSizePricing(size, product, packTenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
});

test('resolveEffectiveUnitPrice: switches to packUnitPrice at the threshold', () => {
  const pricing = { finalPrice: 13300, packUnitPrice: 12700, packThreshold: 6 };
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 5), 13300);
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 6), 12700);
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 8), 12700);
});

test('resolveEffectiveUnitPrice: no pack fields → always finalPrice', () => {
  const pricing = { finalPrice: 13300, packUnitPrice: null, packThreshold: null };
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 50), 13300);
});
