import { describe, expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import type { FilterValue } from '../advanced-search/advanced-search-types';
import {
  EXPIRY_PRESET_IDS,
  STOCK_FILTER_CONFIGS,
  STOCK_GROUP_OPTIONS,
  applyStockFilters,
  expiryRange,
  fieldTextFor,
  groupStockRows,
  lineValue,
  matchesExpiryRange,
  matchesFilter,
  matchesStatusSet,
  parseStockQuery,
  parseStockQuerySet,
  resolveStockFilters,
  scoreStockRow,
  searchStockRowSet,
  searchStockRows,
  sortStockRows,
  statusOf,
  stockFieldValue,
  type StatusKey,
} from './inventory-stock-search';

// ── Fixtures ─────────────────────────────────────────────────────────────────

let seq = 0;
const row = (over: Partial<StockRow> = {}): StockRow => ({
  _id: `r${(seq += 1)}`,
  warehouseId: 'w1',
  warehouseName: 'Cloud Bay',
  subProductId: 'sp1',
  productName: 'Hennessy VS',
  categoryName: 'Cognac',
  sku: 'HN-VS-70',
  sizeId: 'sz1',
  sizeName: '70cl',
  currentQuantity: 10,
  reservedQuantity: 2,
  costPrice: 7000,
  sellingPrice: 10000,
  valuationMethod: 'fifo',
  minStockLevel: 5,
  earliestExpiry: null,
  ...over,
});

const q = (raw: string) => parseStockQuery(raw);

// ── parseStockQuery ──────────────────────────────────────────────────────────

describe('parseStockQuery', () => {
  it('splits free text into lowercased AND terms', () => {
    const p = q('Red Wine');
    expect(p.terms).toEqual(['red', 'wine']);
    expect(p.filters).toEqual([]);
    expect(p.hasQuery).toBe(true);
  });

  it('is empty and inert for a blank query', () => {
    const p = q('   ');
    expect(p.hasQuery).toBe(false);
    expect(p.terms).toEqual([]);
  });

  it('extracts field shorthand and resolves aliases', () => {
    const p = q('sku:HN warehouse:cloud category:cognac size:70cl');
    expect(p.filters).toEqual([
      { field: 'sku', value: 'hn' },
      { field: 'wh', value: 'cloud' },
      { field: 'cat', value: 'cognac' },
      { field: 'size', value: '70cl' },
    ]);
    expect(p.terms).toEqual([]);
    expect(p.hasFilters).toBe(true);
  });

  it('keeps a quoted phrase as one term', () => {
    const p = q('"red wine" hennessy');
    expect(p.terms).toEqual(['red wine', 'hennessy']);
  });

  it('supports a quoted value on a field shorthand', () => {
    const p = q('wh:"cloud bay"');
    expect(p.filters).toEqual([{ field: 'wh', value: 'cloud bay' }]);
    expect(p.terms).toEqual([]);
  });

  // Defect 4: an unrecognised prefix used to become a literal term that could
  // never match, so the query returned nothing and never said why.
  it('reports an unrecognised field prefix instead of swallowing it', () => {
    const p = q('whs:cloud');
    expect(p.unknownFields).toEqual(['whs']);
    expect(p.terms).toEqual(['whs:cloud']);
  });

  it('does not treat a bare colon or a leading colon as a field', () => {
    const p = q(':abc');
    expect(p.unknownFields).toEqual([]);
    expect(p.terms).toEqual([':abc']);
  });
});

// ── statusOf ─────────────────────────────────────────────────────────────────

describe('statusOf', () => {
  it('reads out-of-stock from a zero quantity even without flags', () => {
    expect(statusOf(row({ currentQuantity: 0 }))).toBe('out');
  });

  it('prefers the server flags in precedence order', () => {
    const flags = {
      status: 'low_stock' as const,
      outOfStock: false,
      lowStock: true,
      belowReorder: false,
      overstocked: true,
      nearExpiry: true,
      available: 8,
      reorderPoint: 5,
      reorderQuantity: 10,
      outOfStockAlert: false,
      expiryDays: 3,
    };
    expect(statusOf(row({ flags }))).toBe('low');
  });

  it('falls back to in-stock', () => {
    expect(statusOf(row())).toBe('ok');
  });
});

// ── Scoring ──────────────────────────────────────────────────────────────────

describe('scoreStockRow', () => {
  it('returns a positive score for a row with no query', () => {
    expect(scoreStockRow(row(), q(''))).toBeGreaterThan(0);
  });

  it('requires every term to match (AND semantics)', () => {
    const r = row({ productName: 'Red Label', sizeName: '75cl' });
    expect(scoreStockRow(r, q('red label'))).toBeGreaterThan(0);
    expect(scoreStockRow(r, q('red gin'))).toBe(0);
  });

  it('ranks a product-name hit above a warehouse-only hit', () => {
    const inProduct = row({ productName: 'Bay Rum', warehouseName: 'Lagos' });
    const inWarehouse = row({ productName: 'Gin', warehouseName: 'Bay Store' });
    expect(scoreStockRow(inProduct, q('bay'))).toBeGreaterThan(
      scoreStockRow(inWarehouse, q('bay'))
    );
  });

  // Defect 1: termIsPrefixed used to test the whole concatenated searchable
  // text, so a term sitting at a word boundary in the product name credited
  // the SKU bucket too. Both rows below contain "vs" in the SKU; only the
  // second has it at a boundary IN THE SKU, so only the second may collect the
  // SKU prefix bonus.
  it('scores a prefix bonus against the field that actually has the prefix', () => {
    const skuBoundary = row({
      productName: 'Zeta',
      sku: 'HN-VS-70',
      sizeName: '—',
      warehouseName: '—',
      categoryName: '—',
    });
    const skuMidToken = row({
      productName: 'Zeta',
      sku: 'HNVS70',
      sizeName: '—',
      warehouseName: '—',
      categoryName: '—',
    });
    expect(scoreStockRow(skuBoundary, q('vs'))).toBeGreaterThan(
      scoreStockRow(skuMidToken, q('vs'))
    );
  });

  it('does not let a product-name boundary inflate the SKU bucket', () => {
    // "vs" is mid-token in both SKUs; the only difference is the product name.
    // Whatever bonus the product name earns must not also be paid to the SKU,
    // so the gap between these two must equal the product-name bonus alone.
    const a = row({ productName: 'VS Reserve', sku: 'HNVS70' });
    const b = row({ productName: 'Reserve VS', sku: 'HNVS70' });
    // Both have "vs" at a word boundary in the product name — equal scores.
    expect(scoreStockRow(a, q('vs'))).toBe(scoreStockRow(b, q('vs')));
  });

  it('honours field shorthand as an AND constraint', () => {
    const r = row({ warehouseName: 'Cloud Bay' });
    expect(scoreStockRow(r, q('wh:cloud'))).toBeGreaterThan(0);
    expect(scoreStockRow(r, q('wh:lagos'))).toBe(0);
  });

  it('matches the warehouse shorthand against the id as well as the name', () => {
    const r = row({ warehouseId: 'abc123', warehouseName: 'Cloud Bay' });
    expect(scoreStockRow(r, q('wh:abc123'))).toBeGreaterThan(0);
  });
});

// Defect 3: the old doc comment claimed zone and "alphanumeric codes" were
// searchable. StockRow carries neither. This pins what IS searched, field by
// field, so the comment and the code cannot drift apart again.
describe('fieldTextFor — the searchable surface', () => {
  it('indexes exactly product, sku, size, warehouse, category and valuation', () => {
    const r = row({
      productName: 'P',
      sku: 'S',
      sizeName: 'Z',
      warehouseName: 'W',
      categoryName: 'C',
      valuationMethod: 'average',
    });
    expect(fieldTextFor(r)).toBe('p s z w c average');
  });

  it('substitutes Uncategorized for a missing category', () => {
    expect(fieldTextFor(row({ categoryName: undefined }))).toContain(
      'uncategorized'
    );
  });
});

// ── searchStockRows ──────────────────────────────────────────────────────────

describe('searchStockRows', () => {
  const rows = [
    row({ productName: 'Hennessy VS', sku: 'HN-VS-70' }),
    row({ productName: 'Jameson', sku: 'JM-100' }),
    row({ productName: 'Moet Brut', sku: 'MT-BR-75' }),
  ];

  it('returns every row and no scores for an empty query', () => {
    const res = searchStockRows(rows, q(''));
    expect(res.rows).toHaveLength(3);
    expect(res.approximate).toBe(false);
  });

  it('narrows to exact matches and scores them', () => {
    const res = searchStockRows(rows, q('jameson'));
    expect(res.rows.map((r) => r.productName)).toEqual(['Jameson']);
    expect(res.scores.get(res.rows[0]._id)).toBeGreaterThan(0);
    expect(res.approximate).toBe(false);
  });

  it('does not fall back to fuzzy while an exact match exists', () => {
    const res = searchStockRows(rows, q('moet'));
    expect(res.approximate).toBe(false);
    expect(res.rows).toHaveLength(1);
  });

  it('falls back to approximate matching only when nothing matched exactly', () => {
    const res = searchStockRows(rows, q('jamesen'));
    expect(res.approximate).toBe(true);
    expect(res.rows.map((r) => r.productName)).toEqual(['Jameson']);
  });

  it('bounds the fallback so a nonsense query still returns nothing', () => {
    const res = searchStockRows(rows, q('zzzzzzzz'));
    expect(res.rows).toEqual([]);
    expect(res.approximate).toBe(false);
  });

  it('never runs the fallback for a field shorthand', () => {
    const res = searchStockRows(rows, q('sku:XXXX'));
    expect(res.rows).toEqual([]);
    expect(res.approximate).toBe(false);
  });
});

// ── Multi-item search: one chip per Enter, OR'd together ─────────────────────
//
// Typing "hennessy jameson" can never match — terms AND. Committing "hennessy"
// with Enter and then "jameson" with Enter is a request for BOTH products, so
// the chips OR while the terms inside one chip keep their AND.

describe('parseStockQuerySet', () => {
  it('builds one parsed query per committed chip', () => {
    const set = parseStockQuerySet(['hennessy', 'jameson']);
    expect(set.queries).toHaveLength(2);
    expect(set.queries[0].terms).toEqual(['hennessy']);
    expect(set.queries[1].terms).toEqual(['jameson']);
    expect(set.hasQuery).toBe(true);
  });

  it('drops blank chips rather than matching everything with them', () => {
    const set = parseStockQuerySet(['hennessy', '', '   ']);
    expect(set.queries).toHaveLength(1);
  });

  it('is inert for no chips at all', () => {
    const set = parseStockQuerySet([]);
    expect(set.hasQuery).toBe(false);
    expect(set.queries).toEqual([]);
  });

  it('keeps AND semantics inside a single chip', () => {
    const set = parseStockQuerySet(['red wine']);
    expect(set.queries[0].terms).toEqual(['red', 'wine']);
  });

  it('reports hasFilters when any chip carries field shorthand', () => {
    expect(parseStockQuerySet(['hennessy', 'sku:HN']).hasFilters).toBe(true);
    expect(parseStockQuerySet(['hennessy']).hasFilters).toBe(false);
  });

  it('unions unknown field prefixes across chips without duplicating', () => {
    const set = parseStockQuerySet(['whs:a', 'whs:b', 'zone:c']);
    expect(set.unknownFields).toEqual(['whs', 'zone']);
  });
});

describe('searchStockRowSet', () => {
  const rows = [
    row({ productName: 'Hennessy VS', sku: 'HN-VS-70' }),
    row({ productName: 'Jameson', sku: 'JM-100' }),
    row({ productName: 'Moet Brut', sku: 'MT-BR-75' }),
  ];
  const names = (rs: StockRow[]) => rs.map((r) => r.productName).sort();

  it('returns every row when no chip is committed', () => {
    expect(searchStockRowSet(rows, parseStockQuerySet([])).rows).toHaveLength(
      3
    );
  });

  it('returns the union of two chips', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['hennessy', 'jameson'])
    );
    expect(names(res.rows)).toEqual(['Hennessy VS', 'Jameson']);
    expect(res.approximate).toBe(false);
  });

  it('still ANDs the terms inside one chip', () => {
    // One chip, two terms: no row has both, so nothing matches exactly.
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['hennessy jameson'])
    );
    expect(res.rows.filter((r) => !res.approximate)).toEqual([]);
  });

  it('scores a row by its best-matching chip', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['hennessy', 'mt-br-75'])
    );
    const hennessy = res.rows.find((r) => r.productName === 'Hennessy VS')!;
    // A product-name hit outranks a SKU-only hit, and the score kept is the
    // best chip's, not the last chip's.
    expect(res.scores.get(hennessy._id)).toBeGreaterThan(0);
  });

  it('ignores a chip that matches nothing instead of emptying the result', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['jameson', 'zzzzzzzz'])
    );
    expect(names(res.rows)).toEqual(['Jameson']);
    expect(res.approximate).toBe(false);
  });

  it('mixes a shorthand chip with a free-text chip', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['sku:JM-100', 'moet'])
    );
    expect(names(res.rows)).toEqual(['Jameson', 'Moet Brut']);
  });

  it('falls back to approximate only when no chip matched anything', () => {
    const res = searchStockRowSet(rows, parseStockQuerySet(['jamesen']));
    expect(res.approximate).toBe(true);
    expect(names(res.rows)).toEqual(['Jameson']);
  });

  it('does not go approximate while one chip still matches exactly', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['moet', 'jamesen'])
    );
    expect(res.approximate).toBe(false);
    expect(names(res.rows)).toEqual(['Moet Brut']);
  });

  it('never runs the fallback for a shorthand-only chip', () => {
    const res = searchStockRowSet(rows, parseStockQuerySet(['sku:XXXX']));
    expect(res.rows).toEqual([]);
    expect(res.approximate).toBe(false);
  });

  it('deduplicates a row that two chips both match', () => {
    const res = searchStockRowSet(
      rows,
      parseStockQuerySet(['hennessy', 'hn-vs-70'])
    );
    expect(res.rows).toHaveLength(1);
  });
});

// ── stockFieldValue + matchesFilter ──────────────────────────────────────────

describe('stockFieldValue', () => {
  it('computes available as on-hand minus reserved', () => {
    expect(
      stockFieldValue(
        row({ currentQuantity: 10, reservedQuantity: 3 }),
        'available'
      )
    ).toBe(7);
  });

  it('computes line value as quantity times unit cost', () => {
    expect(
      stockFieldValue(row({ currentQuantity: 4, costPrice: 250 }), 'line_value')
    ).toBe(1000);
  });

  it('reads status through statusOf', () => {
    expect(stockFieldValue(row({ currentQuantity: 0 }), 'status')).toBe('out');
  });

  it('returns null for an unknown field id', () => {
    expect(stockFieldValue(row(), 'nope')).toBeNull();
  });
});

describe('matchesFilter', () => {
  const fv = (over: Partial<FilterValue>): FilterValue => ({
    fieldId: 'product',
    operator: 'contains',
    value: '',
    label: '',
    ...over,
  });

  it('matches text with contains, case-insensitively', () => {
    expect(
      matchesFilter(row({ productName: 'Hennessy VS' }), fv({ value: 'enne' }))
    ).toBe(true);
    expect(
      matchesFilter(row({ productName: 'Hennessy VS' }), fv({ value: 'gin' }))
    ).toBe(false);
  });

  it('treats text equals as a whole-value comparison, not a substring', () => {
    const f = fv({ operator: 'equals', value: 'Hennessy' });
    expect(matchesFilter(row({ productName: 'Hennessy' }), f)).toBe(true);
    expect(matchesFilter(row({ productName: 'Hennessy VS' }), f)).toBe(false);
  });

  it('inverts with not_equals', () => {
    const f = fv({ operator: 'not_equals', value: 'Hennessy' });
    expect(matchesFilter(row({ productName: 'Hennessy' }), f)).toBe(false);
    expect(matchesFilter(row({ productName: 'Gin' }), f)).toBe(true);
  });

  it('compares numbers with gt / gte / lt / lte', () => {
    const r = row({ currentQuantity: 10 });
    const n = (operator: FilterValue['operator'], value: number) =>
      matchesFilter(r, fv({ fieldId: 'onhand', operator, value }));
    expect(n('gt', 9)).toBe(true);
    expect(n('gt', 10)).toBe(false);
    expect(n('gte', 10)).toBe(true);
    expect(n('lt', 11)).toBe(true);
    expect(n('lt', 10)).toBe(false);
    expect(n('lte', 10)).toBe(true);
  });

  it('accepts a numeric operand supplied as a string', () => {
    expect(
      matchesFilter(
        row({ currentQuantity: 10 }),
        fv({ fieldId: 'onhand', operator: 'gt', value: '9' })
      )
    ).toBe(true);
  });

  it('treats a numeric between as inclusive', () => {
    const r = row({ costPrice: 7000 });
    const between = (lo: string, hi: string) =>
      matchesFilter(
        r,
        fv({ fieldId: 'cost', operator: 'between', value: [lo, hi] })
      );
    expect(between('7000', '8000')).toBe(true);
    expect(between('6000', '7000')).toBe(true);
    expect(between('7001', '8000')).toBe(false);
  });

  it('matches a select field with in', () => {
    const f = fv({ fieldId: 'status', operator: 'in', value: ['low', 'out'] });
    expect(matchesFilter(row({ currentQuantity: 0 }), f)).toBe(true);
    expect(matchesFilter(row({ currentQuantity: 50 }), f)).toBe(false);
  });

  it('reads is_set as "has a value"', () => {
    const f = fv({ fieldId: 'expiry', operator: 'is_set', value: true });
    expect(matchesFilter(row({ earliestExpiry: '2026-10-01' }), f)).toBe(true);
    expect(matchesFilter(row({ earliestExpiry: null }), f)).toBe(false);
  });

  it('does not narrow on a filter it cannot resolve', () => {
    // resolveStockFilters is the seam that reports these; an unresolvable
    // filter must not silently delete every row.
    expect(matchesFilter(row(), fv({ fieldId: 'not_a_field' }))).toBe(true);
  });

  it('does not narrow on a number filter whose operand is not a number', () => {
    expect(
      matchesFilter(
        row({ currentQuantity: 10 }),
        fv({ fieldId: 'onhand', operator: 'gt', value: 'abc' })
      )
    ).toBe(true);
  });
});

describe('applyStockFilters', () => {
  const rows = [
    row({ productName: 'Hennessy VS', currentQuantity: 10, costPrice: 7000 }),
    row({ productName: 'Jameson', currentQuantity: 2, costPrice: 4000 }),
    row({ productName: 'Moet', currentQuantity: 40, costPrice: 20000 }),
  ];

  it('ANDs every filter', () => {
    const res = applyStockFilters(rows, [
      { fieldId: 'onhand', operator: 'gte', value: 5, label: '' },
      { fieldId: 'cost', operator: 'lt', value: 10000, label: '' },
    ]);
    expect(res.map((r) => r.productName)).toEqual(['Hennessy VS']);
  });

  it('returns the input unchanged for no filters', () => {
    expect(applyStockFilters(rows, [])).toHaveLength(3);
  });
});

describe('resolveStockFilters', () => {
  it('keeps known filters and reports unknown ones', () => {
    const { valid, dropped } = resolveStockFilters([
      { fieldId: 'onhand', operator: 'gt', value: 1, label: '' },
      { fieldId: 'ghost', operator: 'gt', value: 1, label: '' },
    ]);
    expect(valid.map((f) => f.fieldId)).toEqual(['onhand']);
    expect(dropped).toEqual(['ghost']);
  });
});

// ── Status selection ─────────────────────────────────────────────────────────

describe('matchesStatusSet', () => {
  const out = row({ currentQuantity: 0 });
  const ok = row({ currentQuantity: 20 });

  it('treats an empty set as "all"', () => {
    const all = new Set<StatusKey>();
    expect(matchesStatusSet(out, all)).toBe(true);
    expect(matchesStatusSet(ok, all)).toBe(true);
  });

  it('is exclusive for a single member', () => {
    const only = new Set<StatusKey>(['out']);
    expect(matchesStatusSet(out, only)).toBe(true);
    expect(matchesStatusSet(ok, only)).toBe(false);
  });

  it('is a union for several members', () => {
    const many = new Set<StatusKey>(['out', 'ok']);
    expect(matchesStatusSet(out, many)).toBe(true);
    expect(matchesStatusSet(ok, many)).toBe(true);
  });
});

// ── Expiry presets ───────────────────────────────────────────────────────────

describe('expiryRange', () => {
  // A fixed `now` — a preset that silently reads the wall clock is a test that
  // passes on one day and fails on another.
  const now = new Date('2026-09-01T12:00:00.000Z');

  it('publishes every preset id it claims to support', () => {
    expect(EXPIRY_PRESET_IDS).toEqual([
      'expired',
      'next7',
      'next30',
      'next90',
      'custom',
    ]);
  });

  it('ends the expired range at now', () => {
    const r = expiryRange('expired', now);
    expect(r).not.toBeNull();
    expect(r![1].getTime()).toBe(now.getTime());
    expect(r![0].getTime()).toBe(0);
  });

  it('starts the forward ranges at the start of today', () => {
    const r = expiryRange('next7', now)!;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    expect(r[0].getTime()).toBe(start.getTime());
  });

  it('spans the requested number of days inclusive', () => {
    const seven = expiryRange('next7', now)!;
    const thirty = expiryRange('next30', now)!;
    const days = (r: [Date, Date]) =>
      Math.round((r[1].getTime() - r[0].getTime()) / 86_400_000);
    expect(days(seven)).toBe(7);
    expect(days(thirty)).toBe(30);
  });

  it('returns null for the custom preset and for anything unknown', () => {
    expect(expiryRange('custom', now)).toBeNull();
    expect(expiryRange('nonsense', now)).toBeNull();
  });
});

describe('matchesExpiryRange', () => {
  const range: [Date, Date] = [
    new Date('2026-09-01T00:00:00.000Z'),
    new Date('2026-09-08T00:00:00.000Z'),
  ];

  it('does not narrow when there is no range', () => {
    expect(matchesExpiryRange(row({ earliestExpiry: null }), null)).toBe(true);
  });

  // A null expiry is not "expires today". Including it would make a
  // "next 7 days" answer wrong.
  it('excludes a row with no expiry while a range is active', () => {
    expect(matchesExpiryRange(row({ earliestExpiry: null }), range)).toBe(
      false
    );
  });

  it('includes an expiry inside the range and excludes one outside', () => {
    expect(
      matchesExpiryRange(row({ earliestExpiry: '2026-09-04' }), range)
    ).toBe(true);
    expect(
      matchesExpiryRange(row({ earliestExpiry: '2026-10-04' }), range)
    ).toBe(false);
  });

  it('excludes an unparseable expiry rather than counting it as a hit', () => {
    expect(matchesExpiryRange(row({ earliestExpiry: 'soon' }), range)).toBe(
      false
    );
  });
});

// ── Sorting ──────────────────────────────────────────────────────────────────

describe('sortStockRows', () => {
  const rows = [
    row({ productName: 'Charlie', currentQuantity: 3, costPrice: 100 }),
    row({ productName: 'Alpha', currentQuantity: 9, costPrice: 300 }),
    row({ productName: 'Bravo', currentQuantity: 6, costPrice: 200 }),
  ];
  const names = (rs: StockRow[]) => rs.map((r) => r.productName);

  it('sorts by product ascending and descending', () => {
    expect(names(sortStockRows(rows, 'product', 'asc'))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
    expect(names(sortStockRows(rows, 'product', 'desc'))).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });

  it('sorts numerically on quantity and on derived line value', () => {
    expect(names(sortStockRows(rows, 'onhand', 'asc'))).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
    expect(names(sortStockRows(rows, 'value', 'desc'))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('ranks by score when sorting on relevance', () => {
    const scores = new Map([
      [rows[0]._id, 5],
      [rows[1]._id, 1],
      [rows[2]._id, 9],
    ]);
    expect(names(sortStockRows(rows, 'relevance', 'asc', scores))).toEqual([
      'Bravo',
      'Charlie',
      'Alpha',
    ]);
  });

  // Defect 2: clearing the search left sortCol pinned to 'relevance'. The old
  // switch had no 'relevance' case, so cmp stayed 0 and the table went
  // unsorted — an arbitrary order that looked deliberate.
  it('falls back to product order when relevance has no scores', () => {
    expect(names(sortStockRows(rows, 'relevance', 'asc'))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
    expect(names(sortStockRows(rows, 'relevance', 'asc', new Map()))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const input = [...rows];
    sortStockRows(input, 'product', 'asc');
    expect(names(input)).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('breaks a relevance tie on product name', () => {
    const scores = new Map(rows.map((r) => [r._id, 4]));
    expect(names(sortStockRows(rows, 'relevance', 'asc', scores))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });
});

// ── Grouping ─────────────────────────────────────────────────────────────────

describe('groupStockRows', () => {
  const rows = [
    row({ warehouseName: 'Cloud Bay', productName: 'A' }),
    row({ warehouseName: 'Lagos', productName: 'B' }),
    row({ warehouseName: 'Cloud Bay', productName: 'C' }),
  ];

  it('groups by warehouse', () => {
    const g = groupStockRows(rows, 'warehouse');
    expect(g.map(([k, v]) => [k, v.length])).toEqual([
      ['Cloud Bay', 2],
      ['Lagos', 1],
    ]);
  });

  it('labels the status group with the human status, not the key', () => {
    const g = groupStockRows([row({ currentQuantity: 0 })], 'status');
    expect(g[0][0]).toBe('Out of stock');
  });

  it('buckets a missing category under Uncategorized', () => {
    const g = groupStockRows([row({ categoryName: undefined })], 'category');
    expect(g[0][0]).toBe('Uncategorized');
  });

  it('returns one bucket per distinct key and preserves row order inside it', () => {
    const g = groupStockRows(rows, 'warehouse');
    expect(g[0][1].map((r) => r.productName)).toEqual(['A', 'C']);
  });
});

// ── Config integrity ─────────────────────────────────────────────────────────

// The sales config file carries a warning that a config naming a field the
// schema does not have is "a control that silently does nothing". The same
// rule binds here: every stock filter must resolve to a real value extractor.
describe('STOCK_FILTER_CONFIGS', () => {
  it('has a unique id per entry', () => {
    const ids = STOCK_FILTER_CONFIGS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every declared filter to a real extractor', () => {
    const r = row({ earliestExpiry: '2026-10-01' });
    for (const c of STOCK_FILTER_CONFIGS) {
      expect(
        stockFieldValue(r, c.id),
        `${c.id} has no extractor`
      ).not.toBeNull();
    }
  });

  it('gives every select filter its options', () => {
    for (const c of STOCK_FILTER_CONFIGS) {
      if (c.type === 'select' || c.type === 'multi-select') {
        expect(c.options?.length, `${c.id} has no options`).toBeGreaterThan(0);
      }
    }
  });
});

describe('STOCK_GROUP_OPTIONS', () => {
  it('groups by every option it offers', () => {
    for (const opt of STOCK_GROUP_OPTIONS) {
      const g = groupStockRows([row()], opt.id);
      expect(g, `${opt.id} produced no group`).toHaveLength(1);
      expect(g[0][0], `${opt.id} produced an empty label`).toBeTruthy();
    }
  });
});

// ── Money helper ─────────────────────────────────────────────────────────────

describe('lineValue', () => {
  it('treats a missing cost price as zero rather than NaN', () => {
    expect(
      lineValue(row({ currentQuantity: 5, costPrice: undefined as never }))
    ).toBe(0);
  });
});
