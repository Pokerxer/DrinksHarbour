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

// ── Wholesale price as the platform's cost basis ────────────────────────────

test('markup model: a wholesale price on the size replaces the supplier cost input', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  // Wholesale replaces supplier cost; revenue model still applies markup.
  // Effective cost: 1500 × 1.25 = 1875 → platformSelling: 1875 × 1.15 = 2156.25 → 2200
  const size = { costPrice: 1000, sellingPrice: 0, wholesalePrice: 1500 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1875);
  assert.strictEqual(pricing.isPlatformCostFromWholesale, true);
  assert.strictEqual(pricing.platformSellingPrice, 2200);
});

test('commission model: a wholesale price replaces the supplier cost input (revenue model still applies)', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'commission', commissionPercentage: 10 };
  // Wholesale replaces supplier cost; commission derives from tenantSellingPrice (unchanged).
  // platformCostPrice = tenantPrice × (1 − commission) = 2000 × 0.9 = 1800
  // But effectiveCostPrice = wholesale (1600) replaces costPrice, not tenantSellingPrice.
  // Since commission model uses tenantSellingPrice (not costPrice), platformCostPrice = 2000 × 0.9 = 1800.
  const size = { costPrice: 0, sellingPrice: 2000, wholesalePrice: 1600 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  // Commission model: platformCostPrice = tenantSellingPrice × (1 − commission%)
  // wholesale replaces costPrice (supplier cost), not tenantSellingPrice.
  assert.strictEqual(pricing.platformCostPrice, 1800); // 2000 × 0.9
  assert.strictEqual(pricing.isPlatformCostFromWholesale, true);
  // 1800 × 1.15 = 2070, but undercut caps it just below tenant price 2000 → 1900
  assert.strictEqual(pricing.platformSellingPrice, 1900);
});

test('no wholesale price falls back to the computed platform cost (unchanged behaviour)', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, wholesalePrice: null };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1250);
  assert.strictEqual(pricing.isPlatformCostFromWholesale, false);
});

test('a zero wholesale price is not a price — falls through to the computed platform cost', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  const size = { costPrice: 1000, sellingPrice: 0, wholesalePrice: 0 };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(pricing.platformCostPrice, 1250);
  assert.strictEqual(pricing.isPlatformCostFromWholesale, false);
});

test('admin override pct survives a WHOLESALE price change (auto-recalculated selling)', () => {
  const product = { platformMarkup: 15 };
  const tenant = { revenueModel: 'markup', markupPercentage: 25 };
  // Wholesale replaces supplier cost; revenue model applies markup to it.
  // effectiveCostPrice=1000 → platformCostPrice=1250 → selling=1250×1.30=1625→1700
  const size = { costPrice: 1000, sellingPrice: 0, wholesalePrice: 1000, platformMarkupOverridePct: 30 };

  const before = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(before.platformCostPrice, 1250); // 1000 × 1.25
  assert.strictEqual(before.platformSellingPrice, 1700); // 1250 × 1.30 = 1625 → 1700
  assert.strictEqual(before.isPlatformMarkupOverridden, true);

  // The tenant raises their wholesale rate — the SAME override %
  // is reapplied automatically, exactly like a supplier-cost change does.
  size.wholesalePrice = 1200;
  const after = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(after.platformCostPrice, 1500); // 1200 × 1.25
  assert.strictEqual(after.platformSellingPrice, 2000); // 1500 × 1.30 = 1950 → 2000
});

test('wholesale price feeds into the pack cost via tenant pack rates (not wholesale directly)', () => {
  const product = { platformMarkup: 15 };
  const tenant = {
    revenueModel: 'markup',
    markupPercentage: 25,
    packMarkupPercentage: 10,
    packRateMinUnits: 2,
  };
  const size = {
    costPrice: 1000,
    sellingPrice: 0,
    wholesalePrice: 1500,
    unitsPerPack: 6,
  };

  const pricing = calculateSizePricing(size, product, tenant, 0, 0);
  // Pack cost = wholesale × (1 + packMarkup%) = 1500 × 1.10 = 1650
  assert.strictEqual(pricing.packPlatformCostPrice, 1650);
});

// ── Admin pack-price override round-trip ──────────────────────────────────────
// The review drawer sends a per-size `packUnitPrice`; approval back-calculates
// it into `packPlatformMarkupOverridePct` — a markup over the PACK COST — so
// later tenant cost changes keep the admin's margin relationship. That only
// holds if the back-calc divides by the SAME pack cost `calculateSizePricing`
// will later multiply by. For a size carrying a wholesale price the two used to
// disagree (the back-calc ignored wholesale), so the published pack price came
// out well below the price the admin actually typed.
const toEffectivePct = (adminPrice, packCost) =>
  parseFloat(((adminPrice / packCost - 1) * 100).toFixed(4));

test('admin pack price is published verbatim — wholesale size', () => {
  const product = { platformMarkup: 15 };
  const tenant = {
    revenueModel: 'markup',
    markupPercentage: 15,
    packMarkupPercentage: 10,
    packRateMinUnits: 3,
  };
  const size = {
    costPrice: 16030,
    sellingPrice: 20100,
    wholesalePrice: 14000,
    unitsPerPack: 6,
  };

  const current = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(current.packPlatformCostPrice, 15400); // 14000 × 1.10

  // Admin types a pack price in the review drawer
  const adminPackPrice = 17000;
  size.packPlatformMarkupOverridePct = toEffectivePct(
    adminPackPrice,
    current.packPlatformCostPrice
  );

  const after = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(after.packUnitPrice, adminPackPrice);
  assert.ok(after.packUnitPrice < after.platformSellingPrice);
});

test('admin pack price is published verbatim — no wholesale price', () => {
  const product = { platformMarkup: 15 };
  const tenant = {
    revenueModel: 'markup',
    markupPercentage: 15,
    packMarkupPercentage: 10,
    packRateMinUnits: 3,
  };
  const size = { costPrice: 16030, sellingPrice: 20100, unitsPerPack: 6 };

  const current = calculateSizePricing(size, product, tenant, 0, 0);
  // The reported bug: a brand-new listing whose tenant price sits just above
  // the platform cost basis publishes NO pack offer, because the undercut clamp
  // pins the pack price onto the normal price.
  assert.strictEqual(current.packUnitPrice, null);
  assert.strictEqual(current.packPlatformCostPrice, 17633); // 16030 × 1.10
  assert.strictEqual(current.platformSellingPrice, 20000);

  // ...but the admin can still set one, and it must publish verbatim.
  const adminPackPrice = 19200;
  size.packPlatformMarkupOverridePct = toEffectivePct(
    adminPackPrice,
    current.packPlatformCostPrice
  );

  const after = calculateSizePricing(size, product, tenant, 0, 0);
  assert.strictEqual(after.packUnitPrice, adminPackPrice);
  assert.strictEqual(after.packThreshold, 6);
  assert.strictEqual(after.packSavingsPct, 4);
});
