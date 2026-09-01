import { describe, it, expect } from 'vitest';
import {
  effectivePlatformMarkupPct,
  isPackEligible,
  packSavingsPct,
  resolvePackThreshold,
  suggestPackUnitPrice,
} from './pack-price-utils';

// Real numbers pulled from the catalogue on 2026-09-01. Every sub-product
// created that day has unitsPerPack >= the tenant's packRateMinUnits AND a
// tenant pack markup lower than the normal markup, yet the server publishes
// packUnitPrice: null — the undercut clamp in calcPlatformSellingPrice pins the
// pack price and the normal price to the SAME ₦100 step below the tenant's own
// store price, so the "pack must beat normal" guard suppresses the offer.
const SANDEMAN = {
  // cost 16030, tenant sells at 20100, markup 15%, pack markup 10%
  platformCostPrice: 18434.5,
  platformSellingPrice: 20000, // clamped down from 21200 by the undercut
  packPlatformCostPrice: 17633,
  packUnitPrice: null,
  packThreshold: null,
};

const ABERLOUR = {
  platformCostPrice: 756700,
  platformSellingPrice: 822900,
  packPlatformCostPrice: 723800,
  packUnitPrice: null,
  packThreshold: null,
};

describe('isPackEligible', () => {
  it('is true whenever the server published a pack cost basis', () => {
    expect(isPackEligible(SANDEMAN)).toBe(true);
  });

  it('stays true when the server suppressed packUnitPrice', () => {
    // The regression: the review drawer used to hide the whole Pack Pricing
    // block on packUnitPrice == null, locking the admin out of the one input
    // that would publish a pack rate.
    expect(isPackEligible({ ...SANDEMAN, packUnitPrice: null })).toBe(true);
  });

  it('is false for a size the server never priced as a pack', () => {
    expect(isPackEligible({ packPlatformCostPrice: null })).toBe(false);
    expect(isPackEligible({ packPlatformCostPrice: 0 })).toBe(false);
    expect(isPackEligible(null)).toBe(false);
    expect(isPackEligible(undefined)).toBe(false);
  });
});

describe('suggestPackUnitPrice', () => {
  it('keeps the effective platform markup and applies it to the pack cost', () => {
    // 20000 / 18434.5 = 1.084925 effective markup
    // 17633 * 1.084925 = 19130.68 → round up to the nearest ₦100
    expect(suggestPackUnitPrice(SANDEMAN)).toBe(19200);
  });

  it('works on a high-value size', () => {
    // 822900 / 756700 = 1.087485 ; 723800 * 1.087485 = 787122 → 787200
    expect(suggestPackUnitPrice(ABERLOUR)).toBe(787200);
  });

  it('always lands below the normal platform selling price', () => {
    const suggestion = suggestPackUnitPrice(SANDEMAN)!;
    expect(suggestion).toBeLessThan(SANDEMAN.platformSellingPrice);
  });

  it('always lands above the pack cost, so the pack never loses money', () => {
    const suggestion = suggestPackUnitPrice(SANDEMAN)!;
    expect(suggestion).toBeGreaterThan(SANDEMAN.packPlatformCostPrice);
  });

  it('returns null when the pack cost carries no saving over the normal cost', () => {
    expect(
      suggestPackUnitPrice({
        platformCostPrice: 18434.5,
        platformSellingPrice: 20000,
        packPlatformCostPrice: 18434.5,
      })
    ).toBeNull();
  });

  it('returns null when any input is missing', () => {
    expect(suggestPackUnitPrice(null)).toBeNull();
    expect(
      suggestPackUnitPrice({
        platformCostPrice: 0,
        platformSellingPrice: 20000,
        packPlatformCostPrice: 17633,
      })
    ).toBeNull();
    expect(
      suggestPackUnitPrice({
        platformCostPrice: 18434.5,
        platformSellingPrice: 0,
        packPlatformCostPrice: 17633,
      })
    ).toBeNull();
    expect(
      suggestPackUnitPrice({
        platformCostPrice: 18434.5,
        platformSellingPrice: 20000,
        packPlatformCostPrice: null,
      })
    ).toBeNull();
  });
});

describe('packSavingsPct', () => {
  it('reports the discount the customer earns at the threshold', () => {
    expect(packSavingsPct(19200, 20000)).toBe(4);
  });

  it('is null when there is no saving', () => {
    expect(packSavingsPct(20000, 20000)).toBeNull();
    expect(packSavingsPct(20100, 20000)).toBeNull();
    expect(packSavingsPct(19200, 0)).toBeNull();
  });
});

describe('effectivePlatformMarkupPct', () => {
  it('describes the price actually on screen, not the default markup', () => {
    // The suggested pack price realises ~8.9% over the pack cost, NOT the
    // product's 15% default — the card must not claim ×(1+15%) beside it.
    const suggestion = suggestPackUnitPrice(SANDEMAN)!;
    expect(
      effectivePlatformMarkupPct(suggestion, SANDEMAN.packPlatformCostPrice)
    ).toBe(9);
    expect(
      effectivePlatformMarkupPct(
        SANDEMAN.platformSellingPrice,
        SANDEMAN.platformCostPrice
      )
    ).toBe(8);
  });

  it('is null when there is nothing to derive from', () => {
    expect(effectivePlatformMarkupPct(null, 17633)).toBeNull();
    expect(effectivePlatformMarkupPct(19200, 0)).toBeNull();
  });
});

describe('resolvePackThreshold', () => {
  it('prefers the threshold the server published', () => {
    expect(resolvePackThreshold({ packThreshold: 6 }, 12)).toBe(6);
  });

  it('falls back to the size unitsPerPack when no pack rate was published', () => {
    expect(resolvePackThreshold({ packThreshold: null }, 6)).toBe(6);
  });

  it('is null when the size is not a multi-pack', () => {
    expect(resolvePackThreshold({ packThreshold: null }, 1)).toBeNull();
    expect(resolvePackThreshold(null, undefined)).toBeNull();
  });
});
