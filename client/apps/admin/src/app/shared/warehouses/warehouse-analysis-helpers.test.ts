import { describe, expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import {
  applyFilters,
  availableQty,
  buildGroupedTableCSV,
  computeGroupData,
  computeKpis,
  csvEscapeField,
  expiryBucket,
  fmtMeasureVal,
  stockStatus,
} from './warehouse-analysis-helpers';

// ── Factories ────────────────────────────────────────────────────────────────

let seq = 0;
const row = (over: Partial<StockRow> = {}): StockRow =>
  ({
    _id: `r${++seq}`,
    warehouseId: 'wh1',
    warehouseName: 'Main Shop',
    subProductId: 'sp1',
    productName: 'Jack Daniels',
    sku: 'JD-70',
    sizeId: 'sz1',
    sizeName: '70cl',
    currentQuantity: 10,
    reservedQuantity: 2,
    costPrice: 1000,
    minStockLevel: 4,
    earliestExpiry: null,
    ...over,
  }) as StockRow;

const identity = (v: number) => v;

describe('row derivations', () => {
  it('available = on-hand − reserved, floored at zero', () => {
    expect(availableQty(row())).toBe(8);
    expect(availableQty(row({ currentQuantity: 1, reservedQuantity: 5 }))).toBe(
      0
    );
  });

  it('stock status: out at zero, low at/below minStockLevel (when set), else in', () => {
    // NB: unlike warehouse-detail, analysis status is derived locally from
    // minStockLevel — it does not read server flags.
    expect(stockStatus(row({ currentQuantity: 0 }))).toBe('out');
    expect(stockStatus(row({ currentQuantity: 4 }))).toBe('low'); // = min 4
    expect(stockStatus(row({ currentQuantity: 9 }))).toBe('in');
    expect(stockStatus(row({ currentQuantity: 1, minStockLevel: 0 }))).toBe('in');
  });

  it('expiry buckets split at 30 / 90 days', () => {
    const now = Date.now();
    const days = (n: number) => new Date(now + n * 86_400_000).toISOString();
    expect(expiryBucket(row({ earliestExpiry: days(-1) }, ), now)).toBe('expired');
    expect(expiryBucket(row({ earliestExpiry: days(10) }), now)).toBe('d30');
    expect(expiryBucket(row({ earliestExpiry: days(60) }), now)).toBe('d90');
    expect(expiryBucket(row({ earliestExpiry: days(200) }), now)).toBe('later');
    expect(expiryBucket(row({ earliestExpiry: null }), now)).toBe('none');
  });
});

describe('applyFilters', () => {
  const rows = [
    row({ _id: 'a', productName: 'Jack Daniels', sku: 'JD-70', currentQuantity: 10 }),
    row({ _id: 'b', productName: 'Hennessy', sku: 'HN-75', currentQuantity: 0 }),
    row({
      _id: 'c',
      productName: 'Barefoot',
      sku: 'BF-75',
      currentQuantity: 2,
      subProductId: 'sp3',
    }),
  ];
  const prodMeta = {
    sp3: {
      catId: 'cat-wine',
      catName: 'Wine',
      brandId: 'brand-bf',
      brandName: 'Barefoot',
    },
  };

  it('static stock filters compose (AND)', () => {
    expect(applyFilters(rows, ['in_stock'], {})).toHaveLength(2);
    expect(applyFilters(rows, ['out_of_stock'], {}).map((r) => r._id)).toEqual([
      'b',
    ]);
    expect(applyFilters(rows, ['in_stock', 'out_of_stock'], {})).toHaveLength(0);
  });

  it('search filters match product name or SKU case-insensitively', () => {
    expect(
      applyFilters(rows, ['product_search:jack'], {}).map((r) => r._id)
    ).toEqual(['a']);
    expect(
      applyFilters(rows, ['product_search:hn-'], {}).map((r) => r._id)
    ).toEqual(['b']);
  });

  it('category and brand filters join through prodMeta', () => {
    expect(
      applyFilters(rows, ['category_cat-wine'], prodMeta).map((r) => r._id)
    ).toEqual(['c']);
    expect(
      applyFilters(rows, ['brand_brand-bf'], prodMeta).map((r) => r._id)
    ).toEqual(['c']);
    // Rows without meta are excluded by id-filters (empty catId ≠ match).
    expect(
      applyFilters([rows[0]], ['category_cat-wine'], prodMeta)
    ).toHaveLength(0);
  });
});

describe('computeGroupData / computeKpis', () => {
  it('aggregates stock value per warehouse and sorts desc by default stack', () => {
    const rows = [
      row({ warehouseName: 'A', currentQuantity: 1, costPrice: 100 }),
      row({ warehouseName: 'B', currentQuantity: 2, costPrice: 500 }),
      row({ warehouseName: 'A', currentQuantity: 3, costPrice: 100 }),
    ];
    const out = computeGroupData(rows, 'warehouse', 'stock_value', {}, identity, [
      { field: 'value', dir: 'desc' },
    ]);
    expect(out.map((g) => g.label)).toEqual(['B', 'A']);
    expect(out.find((g) => g.label === 'A')!.value).toBe(400);
    expect(out.find((g) => g.label === 'A')!.orders).toBe(2);
  });

  it('kpis count value, skus, low/out lines and expiry risk', () => {
    const now = Date.now();
    const soon = new Date(now + 10 * 86_400_000).toISOString();
    const rows = [
      row({ currentQuantity: 5, costPrice: 1000, reservedQuantity: 1 }),
      row({ currentQuantity: 0, costPrice: 1000, subProductId: 'sp2' }),
      row({
        currentQuantity: 4,
        costPrice: 500,
        earliestExpiry: soon,
        subProductId: 'sp3',
      }),
    ];
    const k = computeKpis(rows, identity);
    expect(k.value).toBe(5000 + 0 + 2000);
    expect(k.skuCount).toBe(2); // zero-on-hand line contributes no SKU
    expect(k.outLines).toBe(1);
    expect(k.lowLines).toBe(1); // qty 4 ≤ minStockLevel 4
    expect(k.riskValue).toBe(2000);
    expect(Math.round(k.lowOutPct)).toBe(67);
  });
});

describe('CSV export', () => {
  it('escapes RFC-4180 hostile fields', () => {
    expect(csvEscapeField('a,b')).toBe('"a,b"');
    expect(csvEscapeField('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscapeField('x\ny')).toBe('"x\ny"');
    expect(csvEscapeField(42)).toBe('42');
  });

  it('builds rank/share/cumulative columns matching the on-screen table', () => {
    const data = computeGroupData(
      [
        row({ warehouseName: 'A', currentQuantity: 1, costPrice: 300 }),
        row({ warehouseName: 'B', currentQuantity: 1, costPrice: 100 }),
      ],
      'warehouse',
      'stock_value',
      {},
      identity,
      []
    );
    const csv = buildGroupedTableCSV(data, 'Warehouse', 'Stock Value', 'stock_value');
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('#,Warehouse,Lines,Stock Value,Share %,Cumulative %');
    expect(lines[1]).toMatch(/,75\.0,/);
    expect(lines[2]).toMatch(/,25\.0,100\.0$/);
    expect(lines[1]).toContain('₦');
  });

  it('fmtMeasureVal formats currency measures in naira', () => {
    expect(fmtMeasureVal(1500, 'stock_value')).toContain('₦');
    expect(fmtMeasureVal(12, 'on_hand_qty')).toBe('12');
  });
});
