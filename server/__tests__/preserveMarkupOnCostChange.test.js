const { test } = require('node:test');
const assert = require('node:assert');

const {
  preserveEffectivePlatformMarkupOnCostChange,
} = require('../services/subproduct.service');
const { calculateSizePricing } = require('../utils/pricing');

// markup-model tenant, no pack rates → pack override left untouched
const markupTenant = {
  revenueModel: 'markup',
  markupPercentage: 25,
  commissionPercentage: 12,
  packRateMinUnits: 2,
};
const product = { platformMarkup: 15, platformDiscount: null };

test('captures the last effective platform markup so selling price is preserved at the new cost', () => {
  // Old cost = 1000. platformCost = 1000×1.25 = 1250; platformSelling = 1250×1.15 = 1437.5 → round up 1500.
  const size = {
    _id: 's1',
    size: '75cl',
    costPrice: 1000,
    sellingPrice: 2000,
    unitsPerPack: 1,
    platformMarkupOverridePct: null,
    packPlatformMarkupOverridePct: null,
  };
  const before = calculateSizePricing(size, product, markupTenant, 0, 0);

  preserveEffectivePlatformMarkupOnCostChange(size, product, markupTenant, 0, 0);
  assert.ok(size.platformMarkupOverridePct != null, 'override captured');

  // Now the cost rises to 1400. With the captured override, the new selling price
  // preserves the same effective markup over the new platform cost.
  const newSize = { ...size, costPrice: 1400 };
  const after = calculateSizePricing(newSize, product, markupTenant, 0, 0);

  const beforeMarkup = before.platformSellingPrice / before.platformCostPrice;
  const afterMarkup = after.platformSellingPrice / after.platformCostPrice;
  // Same markup ratio (within rounding-to-100 tolerance).
  assert.ok(
    Math.abs(beforeMarkup - afterMarkup) < 0.02,
    `markup preserved: ${beforeMarkup} vs ${afterMarkup}`
  );
});

test('does not overwrite an explicit existing override', () => {
  const size = {
    _id: 's2',
    size: '75cl',
    costPrice: 1000,
    sellingPrice: 2000,
    unitsPerPack: 1,
    platformMarkupOverridePct: 40,
    packPlatformMarkupOverridePct: null,
  };
  preserveEffectivePlatformMarkupOnCostChange(size, product, markupTenant, 0, 0);
  assert.strictEqual(size.platformMarkupOverridePct, 40, 'explicit override untouched');
});

test('captures pack markup for a pack-eligible size when tenant has pack rates', () => {
  const packTenant = {
    ...markupTenant,
    packMarkupPercentage: 10, // reduced pack rate
  };
  const size = {
    _id: 's3',
    size: '75cl',
    costPrice: 1000,
    sellingPrice: 5000,
    unitsPerPack: 6,
    platformMarkupOverridePct: null,
    packPlatformMarkupOverridePct: null,
  };
  const pricing = calculateSizePricing(size, product, packTenant, 0, 0);
  // Pack must actually be published for this test to be meaningful.
  assert.ok(pricing.packUnitPrice > 0 && pricing.packPlatformCostPrice > 0);

  preserveEffectivePlatformMarkupOnCostChange(size, product, packTenant, 0, 0);
  assert.ok(size.packPlatformMarkupOverridePct != null, 'pack override captured');
});
