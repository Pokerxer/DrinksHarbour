// The grouping engine behind /sales/analytics.
//
// Mirrors the shape of the purchases analysis engine but speaks SalesOrder:
// quotations and orders share one ledger here, status is docType-aware, and
// money reads revenue-first (revenue/discount/tax), not cost-first. The
// bucket/multi-series algorithms live once in this file as a generic engine;
// only the sales dimension config below is domain-specific.
//
// Vitest runs `environment: 'node'` — nothing renderable may live here.

import { describe, expect, test } from 'vitest';
import type { SalesOrder, SalesLineItem } from '@/services/salesOrder.service';
import {
  SALES_GROUP_ITEMS,
  SALES_MEASURES,
  IS_CURRENCY,
  soDate,
  resolveSalesItemDimKey,
  getSalesG1Key,
  formatSalesG1Label,
  applySalesFilters,
  aggregateSalesMeasure,
  computeSalesGroupData,
  computeSalesMultiSeries,
  type SalesGroupByKey,
  type SalesMeasure,
} from './sales-analytics-helpers';

function line(over: Partial<SalesLineItem> = {}): SalesLineItem {
  return {
    _id: 'l1',
    lineType: 'product',
    name: 'Hennessy VSOP',
    quantity: 2,
    unitPrice: 25000,
    discount: 0,
    taxRate: 0,
    lineTotal: 50000,
    fulfilledQty: 0,
    postedQty: 0,
    returnedQty: 0,
    ...over,
  };
}

let n = 0;
function so(over: Partial<SalesOrder> = {}): SalesOrder {
  n += 1;
  return {
    _id: `so${n}`,
    soNumber: `SO20260823000${n}`,
    docType: 'order',
    currency: 'NGN',
    customerSnapshot: { name: 'Mai Suq' },
    salesperson: 'Ada',
    orderStatus: 'confirmed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    total: 50000,
    subtotal: 50000,
    discountTotal: 0,
    items: [line()],
    createdAt: '2026-08-10T10:00:00Z',
    ...over,
  } as SalesOrder;
}

describe('dimension config', () => {
  test('every group key and measure is labelled and currency-typed', () => {
    const keys = new Set(SALES_GROUP_ITEMS.map((g) => g.key));
    expect(keys.has('customer')).toBe(true);
    expect(keys.has('salesperson')).toBe(true);
    const labels = SALES_MEASURES.map((m) => m.label);
    expect(labels.some((l) => l.toLowerCase().includes('revenue'))).toBe(true);
    // Every measure must declare whether it formats as money.
    for (const m of SALES_MEASURES) {
      expect(typeof IS_CURRENCY[m.key]).toBe('boolean');
    }
  });
});

describe('getSalesG1Key', () => {
  test('customer falls back to the walk-in bucket, not "unknown"', () => {
    expect(getSalesG1Key(so({ customerSnapshot: undefined }), 'customer', {})).toBe(
      'Walk-in Customer'
    );
  });

  test('status reads the lifecycle field of the right doc type', () => {
    expect(getSalesG1Key(so(), 'status', {})).toBe('Confirmed');
    expect(
      getSalesG1Key(so({ docType: 'quotation', quoteStatus: 'sent' }), 'status', {})
    ).toBe('Sent');
  });

  test('payment method and status buckets', () => {
    expect(getSalesG1Key(so(), 'payment_method', {})).toBe('Cash');
    expect(getSalesG1Key(so(), 'payment_status', {})).toBe('Unpaid');
  });

  test('a populated warehouse ref buckets by name, a bare id by itself', () => {
    expect(
      getSalesG1Key(
        so({ warehouseId: { _id: 'w1', name: 'Maitama' } }),
        'warehouse',
        {}
      )
    ).toBe('Maitama');
    expect(getSalesG1Key(so({ warehouseId: 'w1' }), 'warehouse', {})).toBe('w1');
  });

  test('date keys are sortable strings', () => {
    const key = getSalesG1Key(so(), 'order_month', {});
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('resolveSalesItemDimKey', () => {
  test('product uses the line name, not the sku', () => {
    expect(resolveSalesItemDimKey(line(), 'product', {})).toBe('Hennessy VSOP');
  });

  test('category/brand come from prodMeta keyed by subproduct id', () => {
    const meta = { sp9: { catId: 'c1', catName: 'Spirits', brandId: 'b1', brandName: 'Hennessy' } };
    const l = line({ subproduct: 'sp9' });
    expect(resolveSalesItemDimKey(l, 'product_category', meta)).toBe('Spirits');
    expect(resolveSalesItemDimKey(l, 'brand', meta)).toBe('Hennessy');
    expect(resolveSalesItemDimKey(line(), 'brand', meta)).toBe('No Brand');
  });

  test('sections and notes never become product rows', () => {
    const sec = line({ lineType: 'section', name: 'Add-ons' });
    expect(resolveSalesItemDimKey(sec, 'product', {})).toBe('Add-ons');
    // But aggregation must skip them — covered below.
  });
});

describe('aggregateSalesMeasure', () => {
  const o = so();
  const items = o.items.map((item) => ({ item, currency: 'NGN' }));

  test('revenue sums post-discount line totals including tax', () => {
    const l = line({ quantity: 2, unitPrice: 10000, discount: 10, discountType: 'percentage', taxRate: 7.5, lineTotal: 18000, taxAmount: 1350 });
    const val = aggregateSalesMeasure([o], [{ item: l, currency: 'NGN' }], 'revenue', (a) => a);
    // lineTotal already nets the discount; tax sits on top.
    expect(val).toBe(19350);
  });

  test('quantity counts units, not orders', () => {
    expect(aggregateSalesMeasure([o], items, 'product_qty', (a) => a)).toBe(2);
  });

  test('delivered_qty reads fulfilment progress', () => {
    const l = line({ fulfilledQty: 1 });
    expect(aggregateSalesMeasure([o], [{ item: l, currency: 'NGN' }], 'delivered_qty', (a) => a)).toBe(1);
  });

  test('avg_order divides by distinct orders, not lines', () => {
    const val = aggregateSalesMeasure([o], items, 'avg_order', (a) => a);
    expect(val).toBe(50000);
  });

  test('discount_total sums given discounts off list price', () => {
    const l = line({ quantity: 1, unitPrice: 10000, discount: 2000, discountType: 'fixed', lineTotal: 8000 });
    expect(aggregateSalesMeasure([o], [{ item: l, currency: 'NGN' }], 'discount_total', (a) => a)).toBe(2000);
  });

  test('non-product lines contribute nothing to money or qty', () => {
    const sec = line({ lineType: 'section', name: 'S', quantity: 5, lineTotal: 999999 });
    expect(aggregateSalesMeasure([o], [{ item: sec, currency: 'NGN' }], 'revenue', (a) => a)).toBe(0);
    expect(aggregateSalesMeasure([o], [{ item: sec, currency: 'NGN' }], 'product_qty', (a) => a)).toBe(0);
  });
});

describe('applySalesFilters', () => {
  test('not_cancelled drops cancelled orders and rejected/expired quotes', () => {
    const docs = [
      so(),
      so({ orderStatus: 'cancelled' }),
      so({ docType: 'quotation', quoteStatus: 'rejected' }),
      so({ docType: 'quotation', quoteStatus: 'sent' }),
    ];
    const kept = applySalesFilters(docs, ['not_cancelled'], {});
    expect(kept).toHaveLength(2);
  });

  test('doc-type filter keeps each side clean', () => {
    const docs = [so(), so({ docType: 'quotation' })];
    expect(applySalesFilters(docs, ['type_order'], {})).toHaveLength(1);
    expect(applySalesFilters(docs, ['type_quotation'], {})).toHaveLength(1);
  });

  test('status filters respect the doc type of each document', () => {
    // 'fulfilled' only exists on orders; a quotation can never match it.
    const docs = [
      so({ orderStatus: 'fulfilled' }),
      so({ docType: 'quotation', quoteStatus: 'fulfilled' as never }),
    ];
    expect(applySalesFilters(docs, ['status_fulfilled'], {})).toHaveLength(1);
  });

  test('customer_search matches snapshot names case-insensitively', () => {
    const docs = [so({ customerSnapshot: { name: 'Mai Suq Ltd' } })];
    expect(applySalesFilters(docs, ['customer_search:mai'], {})).toHaveLength(1);
    expect(applySalesFilters(docs, ['customer_search:zhu'], {})).toHaveLength(0);
  });

  test('date filters bucket on document creation day', () => {
    const docs = [so({ createdAt: '2026-08-10T10:00:00Z' })];
    expect(applySalesFilters(docs, ['date_m_2026_8'], {})).toHaveLength(1);
    expect(applySalesFilters(docs, ['date_m_2026_7'], {})).toHaveLength(0);
  });
});

describe('computeSalesGroupData', () => {
  test('buckets by dimension, sorts by value desc, keeps drill-down lists', () => {
    const big = so({ customerSnapshot: { name: 'A Hotel' }, items: [line({ lineTotal: 90000 })], total: 90000 });
    const small = so({ customerSnapshot: { name: 'B Bar' }, _id: 'so-x', soNumber: 'SO-X', items: [line({ lineTotal: 10000 })], total: 10000 });
    const rows = computeSalesGroupData(
      [small, big],
      'customer',
      'revenue',
      {},
      (a) => a,
      []
    );
    expect(rows[0].label).toBe('A Hotel');
    expect(rows[0].value).toBe(90000);
    expect(rows[0].orders).toBe(1);
    expect(rows[0].orderList[0]._id).toBe(big._id);
  });

  test('an item dimension spreads one order across many buckets by line', () => {
    const o = so({
      items: [
        line({ name: 'Beer', subproduct: 'sp1', lineTotal: 300, quantity: 3 }),
        line({ name: 'Wine', subproduct: 'sp2', lineTotal: 700, quantity: 1 }),
      ],
      total: 1000,
    });
    const rows = computeSalesGroupData([o], 'product', 'revenue', {}, (a) => a, []);
    const beer = rows.find((r) => r.label === 'Beer');
    const wine = rows.find((r) => r.label === 'Wine');
    expect(beer?.value).toBe(300);
    expect(wine?.value).toBe(700);
    expect(beer?.orders).toBe(1);
  });

  test('date dimensions sort chronologically even when values zig-zag', () => {
    const june = so({ createdAt: '2026-06-01T00:00:00Z', items: [line({ lineTotal: 5 })], total: 5 });
    const july = so({ createdAt: '2026-07-01T00:00:00Z', _id: 'so-j', soNumber: 'J', items: [line({ lineTotal: 1 })], total: 1 });
    const rows = computeSalesGroupData([july, june], 'order_month', 'revenue', {}, (a) => a, []);
    expect(rows.map((r) => r.isoKey)).toEqual(['2026-06', '2026-07']);
  });

  test('an order without lines still lands in count measures via fallback', () => {
    const empty = so({ items: [] });
    const rows = computeSalesGroupData([empty], 'product', 'count', {}, (a) => a, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].orders).toBe(1);
  });
});

describe('computeSalesMultiSeries', () => {
  test('attributes each line to its own series cell and dedupes row orders', () => {
    const o = so({
      salesperson: 'Ada',
      items: [
        line({ name: 'Beer', subproduct: 'sp1', lineTotal: 300 }),
        line({ name: 'Wine', subproduct: 'sp2', lineTotal: 700 }),
      ],
    });
    const o2 = so({
      salesperson: 'Bola',
      _id: 'so-b',
      soNumber: 'B',
      items: [line({ name: 'Beer', subproduct: 'sp1', lineTotal: 50 })],
      total: 50,
    });
    const ms = computeSalesMultiSeries([o, o2], 'salesperson', 'product', 'revenue', {}, (a) => a, []);
    expect(ms.series.sort()).toEqual(['Beer', 'Wine']);
    const ada = ms.rows.find((r) => r.label === 'Ada');
    expect(ada?.__total__).toBe(1000);
    expect((ada?.['Beer'] as number)).toBe(300);
    expect((ada?.['Wine'] as number)).toBe(700);
    expect(ada?.orders).toBe(1);
    const bola = ms.rows.find((r) => r.label === 'Bola');
    expect(bola?.orders).toBe(1);
  });
});

describe('formatting helpers', () => {
  test('soDate prefers createdAt and tolerates absence', () => {
    expect(soDate({ createdAt: '2026-01-05T00:00:00Z' } as SalesOrder).getFullYear()).toBe(2026);
    expect(Number.isNaN(soDate({} as SalesOrder).getTime())).toBe(false);
  });

  test('month keys render as "Mon YYYY"', () => {
    expect(formatSalesG1Label('2026-07', 'order_month')).toMatch(/Jul 2026/);
  });

  test('measure registry covers every measure key used by IS_CURRENCY', () => {
    for (const m of SALES_MEASURES) {
      expect(IS_CURRENCY[m.key]).toBeDefined();
    }
  });

  test('group keys are unique', () => {
    const keys = SALES_GROUP_ITEMS.map((g) => g.key as string);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// Type-level guard: these unions must stay assignable across modules.
const _k: SalesGroupByKey = 'customer';
const _m: SalesMeasure = 'revenue';
void _k;
void _m;
