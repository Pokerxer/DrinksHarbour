// app/shared/accounting/period-comparison.test.ts
import { describe, expect, it } from 'vitest';
import { periodComparison } from './period-comparison';
import type { ProfitLoss } from '@/services/accounting.service';

const pl = (over: Partial<ProfitLoss> = {}): ProfitLoss => ({
  revenueTotal: 0,
  sales: { gross: 0, reversals: 0, net: 0, documentCount: 0 },
  cogs: { total: 0, source: 'journal' },
  expenseTotal: 0,
  grossProfit: 0,
  netProfit: 0,
  tax: { collected: 0, paid: 0 },
  ...over,
});

describe('periodComparison', () => {
  it('is empty without a prior period to compare against', () => {
    // "All time" has no preceding window. Showing a variance here would invent
    // a baseline the user never asked for.
    expect(periodComparison(pl(), null).rows).toEqual([]);
  });

  it('reads an increase in costs as unfavourable', () => {
    const rows = periodComparison(
      pl({ cogs: { total: 60000, source: 'journal' }, expenseTotal: 40000 }),
      pl({ cogs: { total: 40000, source: 'journal' }, expenseTotal: 25000 })
    ).rows;
    expect(rows.find((r) => r.key === 'cogs')).toMatchObject({
      current: 60000,
      previous: 40000,
      delta: 20000,
      favourable: false, // more cost of goods sold is worse
    });
    expect(rows.find((r) => r.key === 'expenses')).toMatchObject({
      delta: 15000,
      favourable: false,
    });
  });

  it('reads an increase in profit as favourable, including from a loss', () => {
    const rows = periodComparison(pl({ netProfit: 12000 }), pl({ netProfit: -5000 })).rows;
    expect(rows.find((r) => r.key === 'netProfit')).toMatchObject({
      delta: 17000,
      favourable: true,
    });
  });

  it('reads a smaller loss as favourable', () => {
    // -5,000 → -2,000 improved, but a naive "up is good" arrow is wrong here
    // and a naive "delta < 0 is bad" is wrong too.
    const rows = periodComparison(pl({ netProfit: -2000 }), pl({ netProfit: -5000 })).rows;
    expect(rows.find((r) => r.key === 'netProfit')).toMatchObject({
      delta: 3000,
      favourable: true,
    });
  });

  it('treats no change as neither favourable nor unfavourable', () => {
    const rows = periodComparison(pl({ netProfit: 100 }), pl({ netProfit: 100 })).rows;
    expect(rows.find((r) => r.key === 'netProfit')).toMatchObject({ delta: 0, favourable: null });
  });

  it('omits a percentage when the prior figure cannot be a base', () => {
    const zero = periodComparison(pl({ netProfit: 5000 }), pl({ netProfit: 0 })).rows;
    expect(zero.find((r) => r.key === 'netProfit')?.pct).toBeNull();
    const negative = periodComparison(pl({ netProfit: 5000 }), pl({ netProfit: -1000 })).rows;
    expect(negative.find((r) => r.key === 'netProfit')?.pct).toBeNull();
    const usable = periodComparison(pl({ netProfit: 1500 }), pl({ netProfit: 1000 })).rows;
    expect(usable.find((r) => r.key === 'netProfit')?.pct).toBeCloseTo(50);
  });

  it('compares net sales rather than raw sales so reversals are visible', () => {
    const rows = periodComparison(
      pl({ sales: { gross: 500000, reversals: 50000, net: 450000, documentCount: 12 } }),
      pl({ sales: { gross: 400000, reversals: 0, net: 400000, documentCount: 20 } })
    ).rows;
    expect(rows.find((r) => r.key === 'netSales')).toMatchObject({ current: 450000, previous: 400000 });
  });

  it('falls back to revenueTotal when a payload predates the sales split', () => {
    // No `sales` key at all — an older report payload. A present-but-zero
    // split is a real reading of "no sales", not a reason to substitute.
    const legacy = (revenueTotal: number) => ({ ...pl({ revenueTotal }), sales: undefined });
    const rows = periodComparison(legacy(300000), legacy(200000)).rows;
    expect(rows.find((r) => r.key === 'netSales')).toMatchObject({ current: 300000, previous: 200000 });
    const zeroSales = periodComparison(pl({ revenueTotal: 300000 }), pl({ revenueTotal: 200000 })).rows;
    expect(zeroSales.find((r) => r.key === 'netSales')?.current).toBe(0);
  });

  it('rounds money to two decimals like the rest of the ledger', () => {
    const rows = periodComparison(pl({ netProfit: 0.1 }), pl({ netProfit: 0.2 })).rows;
    expect(rows.find((r) => r.key === 'netProfit')?.delta).toBe(-0.1);
  });
});
