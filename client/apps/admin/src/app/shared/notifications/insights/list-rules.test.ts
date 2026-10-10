import { describe, expect, it } from 'vitest';
import { matchesSearch, movementUnits, selectInsightLines } from './list-rules';
import type { InsightLine } from '@/services/notificationInsights.service';
const line = (
  key: string,
  units30: number | null,
  method = 'historical_baseline'
) =>
  ({
    key,
    productName: 'Château Wine',
    sizeName: '75cl',
    sku: key,
    warehouseName: 'Main',
    units30,
    forecast: { method, demand30: units30 },
  }) as InsightLine;
it('keeps incomplete combined movement unknown instead of using a sales subtotal', () => {
  expect(
    movementUnits({ ...line('incomplete', 50), demandUnits30: null })
  ).toBeNull();
  expect(movementUnits({ ...line('complete', 4), demandUnits30: 30 })).toBe(30);
  expect(movementUnits(line('legacy', 4))).toBe(4);
});
describe('insight list controls', () => {
  it('matches separate words and accents across product fields', () => {
    expect(matchesSearch(line('ABC', 5), '75cl chateau abc')).toBe(true);
    expect(matchesSearch(line('ABC', 5), 'beer')).toBe(false);
  });
  it('sorts known sales before missing totals, including least sold', () => {
    expect(
      selectInsightLines(
        [line('unknown', null), line('fast', 30), line('slow', 5)],
        '',
        'all',
        'sales'
      ).map((l) => l.key)
    ).toEqual(['fast', 'slow', 'unknown']);
    expect(
      selectInsightLines(
        [line('unknown', null), line('fast', 30), line('slow', 5)],
        '',
        'all',
        'least'
      ).map((l) => l.key)
    ).toEqual(['slow', 'fast', 'unknown']);
  });
  it('filters missing forecast history without treating it as zero demand', () => {
    expect(
      selectInsightLines(
        [line('known', 0), line('missing', null, 'insufficient_history')],
        '',
        'history',
        'forecast'
      ).map((l) => l.key)
    ).toEqual(['missing']);
  });
});
it('uses custom totals, retaining missing custom history instead of falling back to monthly units', () => {
  const rows = [
    { ...line('monthly', 50), periodUnits: null },
    { ...line('period', 5), periodUnits: 30 },
  ];
  expect(
    selectInsightLines(rows, '', 'all', 'sales').map((l) => l.key)
  ).toEqual(['period', 'monthly']);
});
