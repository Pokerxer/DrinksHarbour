import { describe, it, expect } from 'vitest';
import {
  buildDashboardQuery,
  normalizeDashboardData,
  resolveDashboardParams,
  PERIOD_KEYS,
  type DashboardData,
  type TopProduct,
} from './dashboard.service';

describe('buildDashboardQuery', () => {
  it('returns an empty string when no params are given', () => {
    expect(buildDashboardQuery({})).toBe('');
    expect(buildDashboardQuery({ period: undefined })).toBe('');
  });

  it('serialises a simple period key', () => {
    expect(buildDashboardQuery({ period: '30d' })).toBe('?period=30d');
  });

  it('drops an unrecognised period rather than forwarding it', () => {
    expect(buildDashboardQuery({ period: 'nonsense' })).toBe('');
  });

  it('includes from/to only for the custom period', () => {
    expect(
      buildDashboardQuery({
        period: 'custom',
        from: '2026-03-01',
        to: '2026-03-10',
      })
    ).toBe('?period=custom&from=2026-03-01&to=2026-03-10');
    // from/to are meaningless without period=custom and must not be forwarded
    expect(
      buildDashboardQuery({
        period: '7d',
        from: '2026-03-01',
        to: '2026-03-10',
      })
    ).toBe('?period=7d');
  });

  it('drops custom when from or to is missing', () => {
    expect(buildDashboardQuery({ period: 'custom', from: '2026-03-01' })).toBe(
      ''
    );
    expect(buildDashboardQuery({ period: 'custom' })).toBe('');
  });

  it('exposes the same seven keys the server accepts', () => {
    expect(PERIOD_KEYS).toEqual([
      'today',
      '7d',
      '30d',
      'month',
      'quarter',
      'year',
      'custom',
    ]);
  });
});

it('explicit refresh bypass preserves the selected reporting window', () => {
  expect(buildDashboardQuery({ period: '7d', refresh: true })).toBe('?period=7d&refresh=true');
  expect(buildDashboardQuery({ refresh: true })).toBe('?refresh=true');
});

describe('resolveDashboardParams', () => {
  it('renders the default period for garbage ?period= values', () => {
    expect(resolveDashboardParams({ period: 'banana' })).toEqual({});
    expect(resolveDashboardParams({ period: '' })).toEqual({});
    // Repeated query params arrive as arrays — must degrade, not crash.
    expect(resolveDashboardParams({ period: ['7d'] as never })).toEqual({});
  });

  it('keeps a whitelisted preset and strips from/to', () => {
    expect(resolveDashboardParams({ period: '30d' })).toEqual({ period: '30d' });
    expect(
      resolveDashboardParams({ period: '7d', from: '2026-03-01', to: '2026-03-10' })
    ).toEqual({ period: '7d' });
  });

  it('keeps a well-formed custom range', () => {
    expect(
      resolveDashboardParams({ period: 'custom', from: '2026-03-01', to: '2026-03-10' })
    ).toEqual({ period: 'custom', from: '2026-03-01', to: '2026-03-10' });
  });

  it('degrades malformed or inverted custom ranges to the default', () => {
    expect(resolveDashboardParams({ period: 'custom', from: 'banana', to: '2026-03-10' })).toEqual({});
    // Arrays handed back by Next for repeated params are not dates.
    expect(
      resolveDashboardParams({ period: 'custom', from: ['2026-03-01'] as never, to: '2026-03-10' })
    ).toEqual({});
    expect(resolveDashboardParams({ period: 'custom', from: '2026-03-10', to: '2026-03-01' })).toEqual({});
    expect(resolveDashboardParams({ period: 'custom' })).toEqual({});
  });

  it('always preserves the refresh flag', () => {
    expect(resolveDashboardParams({ period: 'banana', refresh: true })).toEqual({ refresh: true });
    expect(resolveDashboardParams({ period: '30d', refresh: true })).toEqual({
      period: '30d',
      refresh: true,
    });
  });
});

describe('normalizeDashboardData', () => {
  const full: DashboardData = {
    statCards: {
      period: { orders: 2, revenue: 100 },
      previous: { orders: 1, revenue: 50 },
      today: { orders: 3, revenue: 150 },
      yesterday: { orders: 4, revenue: 200 },
      pendingOrders: 5,
      lowStockCount: 6,
      avgOrderValue: 25,
      sparkline: [{ day: 'Mon', date: '2026-10-26', orders: 1, revenue: 10 }],
    },
    salesReport: [{ month: 'Jan', revenue: 1, orders: 1, profit: 1, vendorCost: 1 }],
    statusBreakdown: { pending: 2 },
    paymentBreakdown: [{ method: 'card', count: 1, total: 10 }],
    topProducts: [],
    recentOrders: [],
    customerChart: [{ month: 'Jan', newCustomer: 1, returningCustomer: 2 }],
    profit: { thisMonth: 10, lastMonth: 5, grossRevenue: 100, vendorCost: 90, trend: [] },
    topVendors: [],
    meta: {
      period: 'month',
      label: 'This month',
      comparisonLabel: 'vs last month',
      rangeStart: '2026-10-01',
      rangeEnd: '2026-10-31',
    },
  };

  it('passes a complete payload through unchanged', () => {
    expect(normalizeDashboardData(full)).toEqual(full);
  });

  it('fills missing sections so widgets degrade per-widget, not crash', () => {
    const result = normalizeDashboardData({ salesReport: [] });
    expect(result.statCards.today).toEqual({ orders: 0, revenue: 0 });
    expect(result.salesReport).toEqual([]);
    expect(result.topProducts).toEqual([]);
    expect(result.profit.trend).toEqual([]);
    expect(result.statusBreakdown).toEqual({});
    expect(result.meta.label).toBe('This month');
  });

  it('survives an empty payload entirely', () => {
    expect(normalizeDashboardData(null).meta.period).toBe('month');
    expect(normalizeDashboardData(undefined).statCards.pendingOrders).toBe(0);
  });

  describe('topProducts.productSlug passthrough', () => {
    // The server sends productSlug additively for widget deep links; these pin
    // the explicit normalisation of the one field this service may coerce.

    const rawWith = (products: TopProduct[]) =>
      ({
        topProducts: products,
      }) as unknown as Partial<DashboardData>;

    const bareProduct = {
      id: 'sp-1',
      name: 'Jameson 70cl',
      image: null,
      sku: 'JAM-70CL',
      sold: 2,
      revenue: 3000,
      stock: 11,
      stockStatus: 'in_stock',
      margin: 40,
      vendor: null,
    } as TopProduct;

    it('passes a present productSlug through unchanged', () => {
      const result = normalizeDashboardData(
        rawWith([{ ...bareProduct, productSlug: 'jameson-70cl' }])
      );
      expect(result.topProducts[0].productSlug).toBe('jameson-70cl');
    });

    it("defaults an absent productSlug to '' (older server payloads)", () => {
      const result = normalizeDashboardData(rawWith([{ ...bareProduct }]));
      expect(result.topProducts[0].productSlug).toBe('');
    });

    it("defaults a non-string productSlug to '' and keeps every other field", () => {
      const result = normalizeDashboardData(
        rawWith([{ ...bareProduct, productSlug: 7 as never }])
      );
      expect(result.topProducts[0].productSlug).toBe('');
      expect(result.topProducts[0].id).toBe('sp-1');
      expect(result.topProducts[0].sku).toBe('JAM-70CL');
    });
  });
});
