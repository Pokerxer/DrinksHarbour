// app/shared/purchases/purchases-analytics-helpers.test.ts
//
// Regression tests for the analytics engine's bucketing and export logic:
// local-time day/week buckets (they must agree with the date *filters*, which
// are local), ISO-8601 week numbering, zero-item PO placement, and the CSV
// builder used by the chart-view export.
import { describe, expect, it } from 'vitest';
import {
  formatG1Label,
  getWeekNumber,
  isoWeekKeyOf,
  getPOG1Key,
  computeGroupData,
  buildGroupedViewCSV,
  type ProdMeta,
} from './purchases-analytics-helpers';
import { applyFilters } from './purchases-analytics-helpers';
import type { PurchaseOrder, POItem } from '@/services/purchaseOrder.service';

function po(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    _id: 'po1',
    poNumber: 'PO-0001',
    currency: 'NGN',
    status: 'confirmed',
    items: [],
    ...overrides,
  } as PurchaseOrder;
}

function item(overrides: Partial<POItem> = {}): POItem {
  return {
    subProductId: 'sp1',
    productName: 'Hennessy VS',
    sku: 'HEN-VS',
    quantity: 10,
    packSize: 1,
    packQty: 10,
    unitPrice: 1000,
    packPrice: 1000,
    receivedQty: 0,
    type: 'product',
    ...overrides,
  } as POItem;
}

const NO_META: Record<string, ProdMeta> = {};

describe('order_day bucketing uses the local calendar day', () => {
  // 2026-03-08 23:30 in a UTC+1 timezone is 22:30 UTC — same UTC day. But
  // 2026-03-09 00:30 UTC+1 is 2026-03-08 23:30 UTC: the UTC-day bucket would
  // disagree with the local "Today" filter by one day.
  const lateNightLocal = new Date(2026, 2, 9, 0, 30); // local 00:30 on Mar 9

  it('buckets a PO confirmed after midnight into its local day', () => {
    expect(
      getPOG1Key(po({ confirmationDate: lateNightLocal.toISOString() }), 'order_day', NO_META)
    ).toBe('2026-03-09');
  });

  it('labels the day bucket from its parts without shifting zones', () => {
    expect(formatG1Label('2026-03-09', 'order_day')).toBe('Mar 9');
  });
});

describe('ISO-8601 week numbering', () => {
  it('puts Jan 1 2026 (a Thursday) in week 1 of 2026', () => {
    expect(getWeekNumber(new Date(2026, 0, 1))).toEqual({
      year: 2026,
      week: 1,
    });
  });

  it('assigns the days around a year end to the correct ISO week-year', () => {
    // ISO week 1 of 2025 runs Mon Dec 30 2024 – Sun Jan 5 2025.
    expect(getWeekNumber(new Date(2024, 11, 30))).toEqual({
      year: 2025,
      week: 1,
    });
    // …while the Sunday before it closes week 52 of 2024.
    expect(getWeekNumber(new Date(2024, 11, 29))).toEqual({
      year: 2024,
      week: 52,
    });
    expect(getWeekNumber(new Date(2025, 0, 4))).toEqual({ year: 2025, week: 1 });
    // Jan 1 2025 (Wednesday) still belongs to week 1 of 2025.
    expect(getWeekNumber(new Date(2025, 0, 1))).toEqual({
      year: 2025,
      week: 1,
    });
  });

  it('builds a sortable zero-padded week key', () => {
    expect(isoWeekKeyOf(new Date(2026, 0, 1))).toBe('2026-W01');
  });

  it('keeps order_week keys sorted chronologically as strings', () => {
    const keys = [
      isoWeekKeyOf(new Date(2025, 11, 20)),
      isoWeekKeyOf(new Date(2026, 0, 6)),
      isoWeekKeyOf(new Date(2025, 11, 1)),
    ].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(['2025-W49', '2025-W51', '2026-W02']);
  });
});

describe('zero-item POs in item-dimension grouping', () => {
  it('places an itemless PO into the dimension fallback bucket for counts', () => {
    const rows = computeGroupData(
      [po({ vendorName: 'V' })],
      'brand',
      'count',
      NO_META,
      (v) => v,
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('No Brand');
    expect(rows[0].value).toBe(1);
    expect(rows[0].orders).toBe(1);
  });

  it('matches the fallback used by the two-level grouping engine', () => {
    const single = computeGroupData(
      [po({})],
      'product_category',
      'count',
      NO_META,
      (v) => v,
      []
    );
    expect(single[0].label).toBe('Uncategorized');
  });
});

describe('date filters agree with local day buckets', () => {
  it('a PO bucketed as today also passes the date_today filter', () => {
    const now = new Date();
    const noonToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const order = po({ confirmationDate: noonToday.toISOString() });
    expect(applyFilters([order], ['date_today'], NO_META)).toHaveLength(1);
    expect(getPOG1Key(order, 'order_day', NO_META)).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );
  });
});

describe('buildGroupedViewCSV', () => {
  it('renders a single-level grouped view with totals and percent share', () => {
    const csv = buildGroupedViewCSV({
      groupLabel: 'Vendor',
      measureLabel: 'Total Cost (incl. tax)',
      measure: 'total_cost',
      rows: [
        { label: 'A', value: 300, orders: 2 },
        { label: 'B', value: 100, orders: 1 },
      ],
      totalValue: 400,
      totalOrders: 3,
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Vendor","Orders","Total Cost (incl. tax)","Share %"');
    expect(lines[1]).toContain('"A"');
    expect(lines[1]).toContain('75');
    expect(lines[3]).toContain('"Total"');
    expect(lines[3]).toContain('400');
  });

  it('renders a stacked view with one column per series and row totals', () => {
    const csv = buildGroupedViewCSV({
      groupLabel: 'Vendor',
      measureLabel: 'Total Cost (incl. tax)',
      measure: 'total_cost',
      rows: [
        { label: 'A', orders: 2 },
        { label: 'B', orders: 1 },
      ],
      totalValue: 400,
      totalOrders: 3,
      series: ['Confirmed', 'Received'],
      cellValue: (row, s) => (row.label === 'A' ? (s === 'Confirmed' ? 300 : 0) : 100),
      rowTotals: { A: 300, B: 100 },
      columnTotals: { Confirmed: 400, Received: 0 },
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Vendor","Confirmed","Received","Total"');
    expect(lines[1]).toContain('"A",300,0,300');
    expect(lines[3]).toContain('"Total",400,0,400');
  });

  it('escapes quotes in labels', () => {
    const csv = buildGroupedViewCSV({
      groupLabel: 'Vendor',
      measureLabel: 'M',
      measure: 'count',
      rows: [{ label: 'A "Special" Ltd', value: 1, orders: 1 }],
      totalValue: 1,
      totalOrders: 1,
    });
    expect(csv).toContain('"A ""Special"" Ltd"');
  });
});
