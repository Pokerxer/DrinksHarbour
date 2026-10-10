import { it, expect } from 'vitest';
import type { InsightLine } from '@/services/notificationInsights.service';
import { trend, selectProducts, performanceTotals } from './performance-rules';
const line = (
  key: string,
  units30: number | null,
  units7 = 0,
  previousUnits7 = 0
): InsightLine => ({
  key,
  subProductId: key,
  sizeId: 's',
  warehouseId: 'w',
  productName: key,
  sku: key,
  sizeName: 'Bottle',
  warehouseName: 'Main',
  units30,
  units7,
  previousUnits7,
});
it('weekly changes distinguish new sales, drops, steady and missing history', () => {
  expect(trend(line('new', 4, 4, 0))).toMatchObject({
    status: 'new',
    percent: null,
  });
  expect(trend(line('rising', 30, 10, 5))).toMatchObject({
    status: 'rising',
    percent: 100,
  });
  expect(trend(line('falling', 30, 0, 5))).toMatchObject({
    status: 'falling',
    percent: -100,
  });
  expect(trend(line('steady', 30, 5, 5)).status).toBe('steady');
  expect(trend(line('zero', 0)).status).toBe('no_sales');
  expect(trend({ ...line('missing', null), units7: null }).status).toBe(
    'incomplete'
  );
  expect(trend({ ...line('corrupt', 5), units7: -1 }).status).toBe(
    'incomplete'
  );
});
it('unknown sales sort last in both directions, filters ignore transfer demand and retain exact variants', () => {
  const rows = [
    line('missing', null),
    line('fast', 30, 10, 5),
    { ...line('slow', 5, 1, 2), demandUnits30: 100 },
    line('zero', 0),
  ];
  expect(selectProducts(rows, '', 'all', 'fastest').map((l) => l.key)).toEqual([
    'fast',
    'slow',
    'zero',
    'missing',
  ]);
  expect(selectProducts(rows, '', 'all', 'slowest').map((l) => l.key)).toEqual([
    'zero',
    'slow',
    'fast',
    'missing',
  ]);
  expect(
    selectProducts(rows, '  FAST  ', 'rising', 'fastest').map((l) => l.key)
  ).toEqual(['fast']);
  expect(
    selectProducts(rows, '', 'falling', 'fastest').map((l) => l.key)
  ).toEqual(['slow']);
});
it('totals show known coverage instead of treating missing sales as zero', () => {
  const total = performanceTotals([
    line('fast', 30, 10, 5),
    line('missing', null),
    line('zero', 0),
  ]);
  expect(total).toMatchObject({
    units: 30,
    known: 2,
    total: 3,
    rising: 1,
    falling: 0,
    noSales: 1,
    incomplete: 1,
  });
});
it('multi-word search matches separate fields, accents and whitespace', () => {
  const wine = {
    ...line('p', 30, 5, 4),
    productName: 'Léon Launois Brut',
    sku: 'WYN-55',
    sizeName: '75cl',
  };
  expect(
    selectProducts([wine], '  leon   75CL wyn-55 ', 'all', 'fastest')
  ).toHaveLength(1);
  expect(selectProducts([wine], 'leon missing', 'all', 'fastest')).toHaveLength(
    0
  );
});
it('sales sorts retain known sales when weekly comparison is missing; trend sorts put unknown changes last', () => {
  const best = { ...line('best', 100), units7: null, previousUnits7: null };
  const rows = [line('unknown', null), line('small', 5, 4, 1), best];
  expect(selectProducts(rows, '', 'all', 'fastest').map((l) => l.key)).toEqual([
    'best',
    'small',
    'unknown',
  ]);
  expect(selectProducts(rows, '', 'all', 'slowest').map((l) => l.key)).toEqual([
    'small',
    'best',
    'unknown',
  ]);
  expect(selectProducts(rows, '', 'all', 'growth').map((l) => l.key)).toEqual([
    'small',
    'best',
    'unknown',
  ]);
});
it('sales ranking uses custom period totals rather than the fixed month', () => {
  const lines = [
    { key: 'a', productName: 'A', units30: 50, periodUnits: 2 },
    { key: 'b', productName: 'B', units30: 5, periodUnits: 20 },
  ] as InsightLine[];
  expect(selectProducts(lines, '', 'all', 'fastest').map((l) => l.key)).toEqual(
    ['b', 'a']
  );
});
it('custom period comparisons count a drop to zero as slowing and no recorded sales', () => {
  const line = {
    key: 'a',
    productName: 'A',
    units30: 50,
    periodUnits: 0,
    periodPreviousUnits: 20,
  } as InsightLine;
  expect(trend(line).percent).toBe(-100);
  expect(trend(line).status).toBe('falling');
  expect(performanceTotals([line]).falling).toBe(1);
  expect(performanceTotals([line]).noSales).toBe(1);
  expect(selectProducts([line], '', 'no_sales', 'fastest')).toHaveLength(1);
});
