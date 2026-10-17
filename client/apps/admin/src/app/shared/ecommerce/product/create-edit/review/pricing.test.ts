import { expect, it } from 'vitest';
import {
  evaluatePrice,
  suggestPrice,
  reviewLines,
  buildOverrides,
  listingSalePrice,
} from './pricing';
import type { ReviewListing } from './types';
const sp: ReviewListing = {
  _id: 'sp',
  status: 'pending',
  currency: 'NGN',
  product: { platformMarkup: 15 },
  pricing: {
    costPrice: 1000,
    platformCostPrice: 1250,
    platformSellingPrice: 1500,
    platformMarkupPct: 15,
    tenantReceives: 1000,
  },
};
const line = () => reviewLines(sp)[0];
it('uses payout minus supplier cost for tenant profit; distinguishes markup from margin', () => {
  const result = evaluatePrice(line(), '1500', sp, { platform: '', tenant: '' });
  expect(result.tenantProfit).toBe(250);
  expect(result.tenantMargin).toBe(20);
  expect(result.platformProfit).toBe(250);
  expect(result.platformMargin).toBeCloseTo(16.6667);
});
it('suggests a rounded price at the existing configured platform target; adjusting a target recalculates it', () => {
  expect(suggestPrice(line(), sp, { platform: '', tenant: '' })).toBe(1500);
  expect(suggestPrice(line(), sp, { platform: '20', tenant: '' })).toBe(1600);
  expect(suggestPrice(line(), sp, { platform: '100', tenant: '' })).toBeNull();
});
it('raising a website price cannot change a fixed tenant payout or meet a higher tenant target', () => {
  const result = evaluatePrice(line(), '2000', sp, { platform: '20', tenant: '30' });
  expect(result.tenantProfit).toBe(250);
  expect(result.tenantTargetMet).toBe(false);
  expect(result.requiredPayout).toBeCloseTo(1428.5714);
});
it('accounts for a listing sale in both suggested and entered prices; packs do not stack', () => {
  const sale = {
    ...sp,
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 20,
  };
  expect(listingSalePrice(2000, sale)).toBe(1600);
  expect(suggestPrice(line(), sale, { platform: '20', tenant: '' })).toBe(2000);
  expect(
    evaluatePrice(line(), '1500', sale, { platform: '', tenant: '' }).error
  ).toMatch(/payout/);
});
it('does not invent missing costs, unsupported currency rounding or uneconomic pack savings', () => {
  expect(
    evaluatePrice({ ...line(), pricing: { platformCostPrice: 1250 } }, '1500', sp, {
      platform: '',
      tenant: '',
    }).tenantProfit
  ).toBeNull();
  expect(
    suggestPrice({ ...line(), currency: 'USD' }, sp, { platform: '', tenant: '' })
  ).toBeNull();
  expect(
    suggestPrice(
      {
        ...line(),
        packThreshold: 6,
        pricing: { ...line().pricing, packPlatformCostPrice: 1450 },
      },
      sp,
      { platform: '', tenant: '' },
      true,
      1500
    )
  ).toBeNull();
});
it('serializes changed prices only, supports pack-only changes and validates blank or malformed edits', () => {
  expect(
    buildOverrides([line()], { base: { normal: '1500', pack: '' } }, sp)
  ).toEqual({});
  const sized = {
    ...line(),
    id: 's',
    packThreshold: 6,
    pricing: { ...line().pricing, packPlatformCostPrice: 1100 },
  };
  expect(
    buildOverrides([sized], { s: { normal: '1500', pack: '1300' } }, sp)
  ).toEqual({ sizes: [{ id: 's', packUnitPrice: 1300 }] });
  for (const normal of ['', '1500abc', 'Infinity', '1200', '1501'])
    expect(() =>
      buildOverrides([line()], { base: { normal, pack: '' } }, sp)
    ).toThrow();
});
it('withholds suggestions when supplier cost is missing instead of implying tenant benefit', () => {
  const missing = {
    ...line(),
    pricing: { platformCostPrice: 1250, platformMarkupPct: 15 },
  };
  expect(suggestPrice(missing, sp, { platform: '', tenant: '' })).toBeNull();
});
it('honors an existing listing markup override before falling back to the product default', () => {
  const override = {
    ...line(),
    pricing: { ...line().pricing, platformMarkupPct: 25 },
  };
  expect(suggestPrice(override, sp, { platform: '', tenant: '' })).toBe(1600);
});
it('does not block a sale review on an unchanged pack price that checkout suspends', () => {
  const sale = {
    ...sp,
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 20,
  };
  const sized = {
    ...line(),
    id: 's',
    packThreshold: 6,
    pricing: {
      ...line().pricing,
      platformSellingPrice: 2000,
      packPlatformCostPrice: 1100,
      packUnitPrice: 1400,
    },
  };
  expect(
    buildOverrides([sized], { s: { normal: '2000', pack: '1400' } }, sale)
  ).toEqual({});
});
it('uses an existing pack-specific markup override for pack suggestions', () => {
  const sizedListing = {
    ...sp,
    sizes: [
      {
        _id: 's',
        unitsPerPack: 6,
        packPlatformMarkupOverridePct: 30,
        pricing: {
          costPrice: 1000,
          platformCostPrice: 1250,
          platformSellingPrice: 2500,
          platformMarkupPct: 15,
          packPlatformCostPrice: 1100,
          packUnitPrice: 1500,
        },
      },
    ],
  };
  const sized = reviewLines(sizedListing)[0];
  expect(
    suggestPrice(sized, sizedListing, { platform: '', tenant: '' }, true, 2500)
  ).toBe(1500);
});
it('commission payout follows final customer price and ignores adjustable platform margin targets', () => {
  const listing: ReviewListing = {
    ...sp,
    tenant: { revenueModel: 'commission', commissionPercentage: 13 },
    pricing: {
      costPrice: 6000,
      tenantSellingPrice: 10000,
      platformSellingPrice: 10000,
      platformCostPrice: 8700,
      commissionPct: 13,
      revenueModel: 'commission',
    },
  };
  const row = reviewLines(listing)[0];
  const value = evaluatePrice(row, '9000', listing, { platform: '30', tenant: '' });
  expect(value.payout).toBe(7830);
  expect(value.platformProfit).toBe(1170);
  expect(value.rates.platform).toBe(13);
  expect(value.tenantProfit).toBe(1830);
});
it('commission suggestion meets the tenant target without changing the agreed commission', () => {
  const listing: ReviewListing = {
    ...sp,
    tenant: { revenueModel: 'commission', commissionPercentage: 13 },
    pricing: {
      costPrice: 6000,
      tenantSellingPrice: 10000,
      platformSellingPrice: 10000,
      platformCostPrice: 8700,
      commissionPct: 13,
      revenueModel: 'commission',
    },
  };
  const row = reviewLines(listing)[0];
  expect(suggestPrice(row, listing, { platform: '50', tenant: '25' })).toBe(9200);
  expect(
    evaluatePrice(row, '9200', listing, { platform: '', tenant: '25' })
      .tenantTargetMet
  ).toBe(true);
});
it('blocks a zero final commission price after a full listing discount', () => {
  const listing: ReviewListing = {
    ...sp,
    tenant: { revenueModel: 'commission', commissionPercentage: 13 },
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 100,
  };
  expect(
    evaluatePrice(reviewLines(listing)[0], '1500', listing, {
      platform: '',
      tenant: '',
    }).error
  ).toMatch(/positive/);
});
