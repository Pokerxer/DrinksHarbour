import { describe, expect, it } from 'vitest';
import { applyRuleTransform } from './utils';

describe('applyRuleTransform — markupBase', () => {
  it('default (cost) applies markup to costPrice', () => {
    const rule = { priceType: 'formula', markupPercentage: 25 };
    expect(applyRuleTransform(10000, rule, 7000)).toBe(8750);
  });

  it('markupBase=wholesale applies markup to wholesalePrice', () => {
    const rule = { priceType: 'formula', markupPercentage: 20, markupBase: 'wholesale' };
    // wholesale 6000 × 1.20 = 7200; costPrice is ignored
    expect(applyRuleTransform(10000, rule, 7000, 6000)).toBe(7200);
  });

  it('markupBase=wholesale falls back to retail when wholesalePrice is 0', () => {
    const rule = { priceType: 'formula', markupPercentage: 20, markupBase: 'wholesale' };
    // no wholesale → no-op, returns original price
    expect(applyRuleTransform(10000, rule, 7000, 0)).toBe(10000);
  });

  it('percentage discount is unaffected by wholesalePrice', () => {
    const rule = { priceType: 'discount', discountType: 'percentage', discountPercentage: 10 };
    expect(applyRuleTransform(10000, rule, 0, 6000)).toBe(9000);
  });

  it('fixed price is unaffected by wholesalePrice', () => {
    const rule = { priceType: 'fixed', fixedPrice: 8000 };
    expect(applyRuleTransform(10000, rule, 0, 6000)).toBe(8000);
  });
});
