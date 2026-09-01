import { describe, it, expect } from 'vitest';
import {
  fmt,
  fmtDate,
  buildBundleName,
  ruleStatus,
  ruleDescription,
} from './rule-format';
import type { PricelistRule } from './types';

describe('fmt', () => {
  it('formats naira with 2 decimals', () => {
    expect(fmt(0)).toBe('₦0.00');
    expect(fmt(1500.5)).toBe('₦1,500.50');
    expect(fmt(null)).toBe('₦0.00');
    expect(fmt(undefined)).toBe('₦0.00');
    expect(fmt(NaN)).toBe('₦0.00');
  });
});

describe('fmtDate', () => {
  it('returns empty for falsy input', () => {
    expect(fmtDate('')).toBe('');
    expect(fmtDate(undefined)).toBe('');
    expect(fmtDate(null)).toBe('');
  });
  it('returns empty for unparseable input', () => {
    expect(fmtDate('not-a-date')).toBe('');
  });
  it('formats en-GB short date', () => {
    // UTC noon avoids timezone flakiness
    expect(fmtDate('2026-01-05T12:00:00Z')).toMatch(/05 Jan 2026/);
  });
});

describe('buildBundleName', () => {
  it('builds percentage name', () => {
    expect(buildBundleName(3, 'percentage', 20)).toBe('Buy 3+ · 20% off');
  });
  it('builds fixed name', () => {
    expect(buildBundleName(2, 'fixed', 500)).toBe('Buy 2+ · ₦500 off');
  });
});

const nowPlus = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();
const nowMinus = (days: number) => nowPlus(-days);

describe('ruleStatus', () => {
  it('expired when endDate past', () => {
    const r = ruleStatus({ endDate: nowMinus(1) });
    expect(r.label).toBe('Expired');
    expect(r.cls).toContain('red');
  });
  it('pending when startDate future', () => {
    expect(ruleStatus({ startDate: nowPlus(1) }).label).toBe('Pending');
  });
  it('active when spanning now', () => {
    expect(
      ruleStatus({ startDate: nowMinus(1), endDate: nowPlus(1) }).label
    ).toBe('Active');
  });
  it('always when undated', () => {
    expect(ruleStatus({}).label).toBe('Always');
  });
});

describe('ruleDescription', () => {
  const base = { _id: 'r1', priceType: 'discount' as const };
  it('fixed', () => {
    expect(
      ruleDescription({ ...base, priceType: 'fixed', fixedPrice: 5000 })
    ).toBe('Sets selling price → ₦5,000.00');
  });
  it('formula', () => {
    expect(
      ruleDescription({ ...base, priceType: 'formula', markupPercentage: 25 })
    ).toBe('Price = cost × (1 + 25% markup)');
  });
  it('formula on wholesale base', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'formula',
        markupPercentage: 25,
        markupBase: 'wholesale',
      })
    ).toBe('Price = wholesale × (1 + 25% markup)');
  });
  it('percentage discount', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'discount',
        discountType: 'percentage',
        discountPercentage: 15,
      })
    ).toBe('15% off selling price');
  });
  it('fixed discount', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'discount',
        discountType: 'fixed',
        discountAmount: 300,
      })
    ).toBe('-₦300.00 off selling price');
  });
  it('flash sale with qty', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'flash_sale',
        flashSalePercentage: 30,
        flashSaleQty: 50,
      })
    ).toBe('⚡ 30% flash sale · 50 units');
  });
  it('bundle variants', () => {
    const b = { ...base, priceType: 'bundle' as const, bundleQuantity: 4 };
    expect(
      ruleDescription({ ...b, bundleDiscountType: 'percentage', bundleDiscount: 20 })
    ).toBe('Buy 4+ → 20% off');
    expect(
      ruleDescription({ ...b, bundleDiscountType: 'fixed', bundleDiscount: 200 })
    ).toBe('Buy 4+ → -₦200 per unit');
    expect(
      ruleDescription({
        ...b,
        bundleDiscountType: 'markup_on_cost',
        bundleDiscount: 10,
      })
    ).toBe('Buy 4+ → Cost +10% markup');
    expect(ruleDescription({ ...b, bundleDiscountType: 'no_discount' })).toBe(
      'Buy 4+ → No discount (base price)'
    );
  });
  it('bundle markup_on_cost with wholesale base', () => {
    const desc = ruleDescription({
      ...base,
      priceType: 'bundle',
      bundleQuantity: 2,
      bundleDiscountType: 'markup_on_cost',
      bundleDiscount: 15,
      bundleMarkupBase: 'wholesale',
    });
    expect(desc).toBe('Buy 2+ → Wholesale +15% markup');
  });
  it('bundle cross-product target suffix', () => {
    const desc = ruleDescription({
      ...base,
      priceType: 'bundle',
      bundleQuantity: 2,
      bundleDiscountType: 'percentage',
      bundleDiscount: 10,
      bundleTargetSubProduct: { _id: 'x', product: { name: 'Henessy 70cl' } },
    });
    expect(desc).toBe('Buy 2+ → 10% off Henessy 70cl');
  });
  it('bundle string target has no suffix', () => {
    const desc = ruleDescription({
      ...base,
      priceType: 'bundle',
      bundleQuantity: 2,
      bundleDiscountType: 'percentage',
      bundleDiscount: 10,
      bundleTargetSubProduct: 'abc123',
    });
    expect(desc).toBe('Buy 2+ → 10% off');
  });
  it('cart_threshold percentage', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'cart_threshold',
        thresholdAmount: 100000,
        discountType: 'percentage',
        discountPercentage: 5,
      })
    ).toBe('Spend ₦100,000.00+ → 5% off cart');
  });
  it('unknown type', () => {
    expect(
      ruleDescription({
        ...base,
        priceType: 'mystery' as PricelistRule['priceType'],
      })
    ).toBe('—');
  });
});
