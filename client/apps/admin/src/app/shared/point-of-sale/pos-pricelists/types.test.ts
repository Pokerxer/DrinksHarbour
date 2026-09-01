import { describe, it, expect } from 'vitest';
import {
  subproductWholesalePrice,
  hasWholesalePrice,
  subproductPackSize,
  hasPackSize,
  needsRuleHydration,
  type SubProductLite,
  type Pricelist,
  type PricelistRule,
  basisCoverage,
  sortRulesBySequence,
  priorityReason,
} from './types';

describe('subproductWholesalePrice', () => {
  const base: SubProductLite = { _id: 's1' };

  it('returns 0 when there are no sizes', () => {
    expect(subproductWholesalePrice(base)).toBe(0);
    expect(subproductWholesalePrice(undefined)).toBe(0);
  });

  it('returns 0 when no size has a wholesale price', () => {
    const p = { ...base, sizes: [{ size: '50cl', costPrice: 100 }] };
    expect(subproductWholesalePrice(p)).toBe(0);
  });

  it('prefers the default size wholesale price', () => {
    const p = {
      ...base,
      sizes: [
        { size: '50cl', wholesalePrice: 100, isDefault: false },
        { size: '70cl', wholesalePrice: 200, isDefault: true },
      ],
    };
    expect(subproductWholesalePrice(p)).toBe(200);
  });

  it('falls back to the first size that has a wholesale price', () => {
    const p = {
      ...base,
      sizes: [
        { size: '50cl', wholesalePrice: 0, isDefault: true },
        { size: '70cl', wholesalePrice: 300, isDefault: false },
      ],
    };
    expect(subproductWholesalePrice(p)).toBe(300);
  });

  it('returns 0 when no size has a positive wholesale price', () => {
    const p = {
      ...base,
      sizes: [
        { size: '50cl', wholesalePrice: 0, isDefault: true },
        { size: '70cl', wholesalePrice: undefined },
      ],
    };
    expect(subproductWholesalePrice(p)).toBe(0);
  });
});

describe('hasWholesalePrice', () => {
  it('is true only when a wholesale price is present', () => {
    expect(hasWholesalePrice(undefined)).toBe(false);
    expect(hasWholesalePrice({ _id: 'x' })).toBe(false);
    expect(
      hasWholesalePrice({
        _id: 'x',
        sizes: [{ size: '50cl', wholesalePrice: 100 }],
      })
    ).toBe(true);
  });
});

describe('subproductPackSize', () => {
  const base: SubProductLite = { _id: 's1' };

  it('returns 0 when there are no sizes', () => {
    expect(subproductPackSize(base)).toBe(0);
    expect(subproductPackSize(undefined)).toBe(0);
  });

  it('returns 0 when no size has a meaningful (>1) pack size', () => {
    const p = { ...base, sizes: [{ size: '50cl', unitsPerPack: 1 }] };
    expect(subproductPackSize(p)).toBe(0);
  });

  it('prefers the default size pack size', () => {
    const p = {
      ...base,
      sizes: [
        { size: '50cl', unitsPerPack: 6, isDefault: false },
        { size: '70cl', unitsPerPack: 12, isDefault: true },
      ],
    };
    expect(subproductPackSize(p)).toBe(12);
  });

  it('falls back to the first size with pack size > 1', () => {
    const p = {
      ...base,
      sizes: [
        { size: '50cl', unitsPerPack: 1, isDefault: true },
        { size: '70cl', unitsPerPack: 6, isDefault: false },
      ],
    };
    expect(subproductPackSize(p)).toBe(6);
  });
});

describe('hasPackSize', () => {
  it('is true only when a pack size > 1 is present', () => {
    expect(hasPackSize(undefined)).toBe(false);
    expect(hasPackSize({ _id: 'x' })).toBe(false);
    expect(
      hasPackSize({ _id: 'x', sizes: [{ size: '50cl', unitsPerPack: 1 }] })
    ).toBe(false);
    expect(
      hasPackSize({ _id: 'x', sizes: [{ size: '50cl', unitsPerPack: 6 }] })
    ).toBe(true);
  });
});

describe('needsRuleHydration', () => {
  const listRow: Pricelist = { _id: 'p1', name: 'Promo' };

  it('is true for a row straight off the list endpoint (rules stripped)', () => {
    // GET /api/pricelists projects `rules` away, so a clicked row has none.
    expect(needsRuleHydration(listRow)).toBe(true);
  });

  it('is false once the detail fetch has returned rules', () => {
    expect(
      needsRuleHydration({
        ...listRow,
        rules: [{ _id: 'r1', priceType: 'fixed' }],
      })
    ).toBe(false);
  });

  it('distinguishes "no rules" from "not loaded" — an empty array is loaded', () => {
    expect(needsRuleHydration({ ...listRow, rules: [] })).toBe(false);
  });

  it('is false when nothing is selected', () => {
    expect(needsRuleHydration(null)).toBe(false);
    expect(needsRuleHydration(undefined)).toBe(false);
  });
});

describe('basisCoverage', () => {
  const sized = (wholesalePrice: number, unitsPerPack = 1) => ({
    _id: Math.random().toString(36).slice(2),
    sizes: [{ isDefault: true, wholesalePrice, unitsPerPack }],
  });

  it('counts nothing for an empty or missing catalogue', () => {
    expect(basisCoverage([])).toEqual({
      total: 0,
      withWholesale: 0,
      withoutWholesale: 0,
      withPack: 0,
      withoutPack: 0,
    });
    expect(basisCoverage(undefined).total).toBe(0);
  });

  it('separates products that can satisfy a wholesale basis from those that cannot', () => {
    // Mirrors the live Wyn City catalogue: a handful of wines priced for
    // wholesale, the rest with none at all.
    const cov = basisCoverage([
      sized(11808, 6),
      sized(13392, 6),
      sized(0, 6),
      sized(0, 6),
      sized(0, 1),
    ]);
    expect(cov.total).toBe(5);
    expect(cov.withWholesale).toBe(2);
    expect(cov.withoutWholesale).toBe(3);
    expect(cov.withPack).toBe(4);
    expect(cov.withoutPack).toBe(1);
  });

  it('treats a null wholesale price as absent, not as zero-cost', () => {
    // 927 of the tenant's 1004 sizes store exactly this.
    const cov = basisCoverage([
      { _id: 'a', sizes: [{ isDefault: true, wholesalePrice: null as never }] },
    ]);
    expect(cov.withWholesale).toBe(0);
    expect(cov.withoutWholesale).toBe(1);
  });
});

describe('sortRulesBySequence', () => {
  const rule = (_id: string, sequence?: number): PricelistRule => ({
    _id,
    priceType: 'discount',
    sequence,
  });

  it('orders by ascending sequence, not by stored document order', () => {
    // The reorder endpoint rewrites `sequence` but leaves the stored array
    // order alone, so a reordered pricelist arrives from GET /:id looking
    // exactly as it did before the move. Both pricing engines read `sequence`.
    const stored = [rule('a', 2), rule('b', 0), rule('c', 1)];
    expect(sortRulesBySequence(stored).map((r) => r._id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const stored = [rule('a', 2), rule('b', 0)];
    sortRulesBySequence(stored);
    expect(stored.map((r) => r._id)).toEqual(['a', 'b']);
  });

  it('breaks ties on _id so duplicate sequences order deterministically', () => {
    // `POST /:id/rules` used to assign `sequence = rules.length`, which
    // duplicates a live sequence on any pricelist that has had a rule deleted.
    const forward = sortRulesBySequence([rule('b', 1), rule('a', 1)]);
    const reverse = sortRulesBySequence([rule('a', 1), rule('b', 1)]);
    expect(forward.map((r) => r._id)).toEqual(['a', 'b']);
    expect(reverse.map((r) => r._id)).toEqual(['a', 'b']);
  });

  it('treats a missing sequence as 0, matching both pricing engines', () => {
    const sorted = sortRulesBySequence([rule('a', 1), rule('b')]);
    expect(sorted.map((r) => r._id)).toEqual(['b', 'a']);
  });

  it('returns an empty array for missing rules', () => {
    expect(sortRulesBySequence(undefined)).toEqual([]);
    expect(sortRulesBySequence([])).toEqual([]);
  });
});

describe('priorityReason', () => {
  const rule = (over: Partial<PricelistRule>): PricelistRule => ({
    _id: 'r1',
    priceType: 'discount',
    ...over,
  });

  it('names base-setting rules as setting the price', () => {
    // fixed/formula assign `result =` in applyPriceRules, which is why they
    // rank ahead of everything that merely adjusts a price.
    expect(priorityReason(rule({ priceType: 'fixed' }))).toBe('Sets the price');
    expect(priorityReason(rule({ priceType: 'formula' }))).toBe('Sets the price');
  });

  it('names modifiers as adjusting the price', () => {
    expect(priorityReason(rule({ priceType: 'discount' }))).toBe('Adjusts the price');
    expect(priorityReason(rule({ priceType: 'flash_sale' }))).toBe('Adjusts the price');
  });

  it('marks a product-specific rule as more specific', () => {
    expect(priorityReason(rule({ priceType: 'fixed', subProduct: 'sp1' }))).toBe(
      'Specific product · sets the price'
    );
  });

  it('names the volume tier when one applies', () => {
    expect(priorityReason(rule({ priceType: 'discount', minQuantity: 6 }))).toBe(
      'Adjusts the price · qty 6+'
    );
  });

  it('separates bundle and cart rules, which never join the per-line pool', () => {
    expect(priorityReason(rule({ priceType: 'bundle' }))).toBe('Bundle');
    expect(priorityReason(rule({ priceType: 'cart_threshold' }))).toBe('Whole cart');
  });
});
