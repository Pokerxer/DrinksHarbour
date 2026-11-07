import { expect, it } from 'vitest';
import {
  evaluatePrice,
  suggestPrice,
  reviewLines,
  buildOverrides,
} from './pricing';
import type { ReviewListing } from './types';
const listing: ReviewListing = {
  _id: 'sp',
  status: 'active',
  tenant: {
    revenueModel: 'selling_price_markup',
    sellingPriceMarkupPercentage: 20,
  },
  pricing: {
    revenueModel: 'selling_price_markup',
    tenantSellingPrice: 100000,
    platformCostPrice: 100000,
    platformSellingPrice: 120000,
    sellingPriceMarkupPct: 20,
    inheritedSellingPriceMarkupPct: 20,
    inheritedMarketplacePrice: 120000,
    costPrice: 90000,
  },
};
const targets = { platform: '', tenant: '' };
it('previews the percentage implied by an edited website price while keeping retail payout fixed', () => {
  const result = evaluatePrice(
    reviewLines(listing)[0],
    '125000',
    listing,
    targets
  );
  expect(result.sellingMarkupPct).toBe(25);
  expect(result.payout).toBe(100000);
  expect(result.platformProfit).toBe(25000);
});
it('uses tenant retail and reverses catalogue discount when previewing the persisted percentage', () => {
  const discounted = {
    ...listing,
    pricing: {
      ...listing.pricing,
      platformSellingPrice: 114000,
      productDiscount: { active: true, value: 5, type: 'percentage' },
    },
  };
  expect(
    evaluatePrice(reviewLines(discounted)[0], '118800', discounted, targets)
      .sellingMarkupPct
  ).toBe(25.0526);
});
it('rejects a percentage above the supported limit before approval', () => {
  expect(() =>
    buildOverrides(
      reviewLines(listing),
      { base: { normal: '601000', pack: '' } },
      listing
    )
  ).toThrow(/500/);
});
it('missing tenant retail cannot be replaced by a supplier cost or saved payout', () => {
  const invalid = {
    ...listing,
    pricing: { ...listing.pricing, tenantSellingPrice: 0 },
  };
  expect(
    evaluatePrice(reviewLines(invalid)[0], '125000', invalid, targets).error
  ).toMatch(/selling price/i);
});
it('supplier cost is not required to suggest a marketplace price under this model', () => {
  const noCost = {
    ...listing,
    pricing: { ...listing.pricing, costPrice: undefined },
  };
  expect(suggestPrice(reviewLines(noCost)[0], noCost, targets)).toBe(120000);
});
it('does not advertise or persist stale pack settings for selling-price markup', () => {
  const sized: ReviewListing = {
    ...listing,
    sizes: [
      {
        _id: 's',
        unitsPerPack: 6,
        pricing: {
          ...listing.pricing,
          packPlatformCostPrice: 100000,
          packUnitPrice: 110000,
          packThreshold: 6,
        },
      },
    ],
  };
  const rows = reviewLines(sized);
  expect(rows[0].packThreshold).toBeNull();
  expect(
    buildOverrides(rows, { s: { normal: '125000', pack: '110000' } }, sized)
  ).toEqual({ sizes: [{ id: 's', websitePrice: 125000 }] });
});
it('preserves a saved zero percentage when clean-hundred rounding changes the displayed ratio', () => {
  const rounded = {
    ...listing,
    pricing: {
      ...listing.pricing,
      tenantSellingPrice: 100001,
      platformCostPrice: 100001,
      platformSellingPrice: 100100,
      sellingPriceMarkupPct: 0,
    },
  };
  expect(
    evaluatePrice(reviewLines(rounded)[0], '100100', rounded, targets)
      .sellingMarkupPct
  ).toBe(0);
});
it('explicit zero default reset remains valid even when the old product override is nonzero', () => {
  const zeroDefault = {
    ...listing,
    tenant: { ...listing.tenant, sellingPriceMarkupPercentage: 0 },
    pricing: {
      ...listing.pricing,
      inheritedSellingPriceMarkupPct: 0,
      inheritedMarketplacePrice: 100000,
      sellingPriceMarkupPct: 25,
      platformSellingPrice: 125000,
    },
  };
  expect(
    evaluatePrice(
      reviewLines(zeroDefault)[0],
      '100000',
      zeroDefault,
      targets,
      false,
      undefined,
      true
    ).sellingMarkupPct
  ).toBe(0);
  expect(
    buildOverrides(
      reviewLines(zeroDefault),
      { base: { normal: '100000', pack: '', inherit: 'true' } },
      zeroDefault
    )
  ).toEqual({ useTenantDefault: true });
});
it('listing sales change customer proceeds without changing the percentage stored from the website price', () => {
  const sale = {
    ...listing,
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 5,
  };
  const result = evaluatePrice(reviewLines(sale)[0], '125000', sale, targets);
  expect(result.sellingMarkupPct).toBe(25);
  expect(result.customer).toBe(118800);
  expect(result.platformProfit).toBe(18800);
});
it('reverses fixed catalogue discounts and refuses impossible suggestions', () => {
  const sale = {
    ...listing,
    pricing: {
      ...listing.pricing,
      platformSellingPrice: 115000,
      productDiscount: { active: true, type: 'fixed', value: 5000 },
    },
  };
  expect(
    evaluatePrice(reviewLines(sale)[0], '120000', sale, targets)
      .sellingMarkupPct
  ).toBe(25);
  expect(
    suggestPrice(reviewLines(listing)[0], listing, {
      platform: '95',
      tenant: '',
    })
  ).toBeNull();
});
it('a changed retail price recalculates the preview against retail instead of supplier cost', () => {
  const updated = {
    ...listing,
    pricing: {
      ...listing.pricing,
      tenantSellingPrice: 120000,
      platformCostPrice: 120000,
      platformSellingPrice: 144000,
    },
  };
  expect(
    evaluatePrice(reviewLines(updated)[0], '150000', updated, targets)
      .sellingMarkupPct
  ).toBe(25);
});
it('stale pack drafts cannot create an edited row for a model with no separate pack pricing', async () => {
  const { inspectRows } = await import('./workspace');
  const result = inspectRows(
    reviewLines(listing),
    { base: { normal: '120000', pack: '110000' } },
    listing,
    targets
  );
  expect(result[0].changed).toBe(false);
  expect(result[0].pack).toBeNull();
});
it('rounds retail payout to kobo before deriving the percentage, matching server settlement', () => {
  const fractional = {
    ...listing,
    pricing: { ...listing.pricing, tenantSellingPrice: 100000.004 },
  };
  const result = evaluatePrice(
    reviewLines(fractional)[0],
    '125000',
    fractional,
    targets
  );
  expect(result.sellingMarkupPct).toBe(25);
  expect(result.payout).toBe(100000);
});
