import { describe, expect, it } from 'vitest';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  buildExportColumns,
  contextNoteOf,
  csvEscape,
  fileBaseOf,
  totalsCellFor,
} from './export-helpers';
import { availOf, statusOf } from './row-utils';

const row = (over: Partial<WarehouseStockRow>): WarehouseStockRow =>
  ({
    _id: 'ws1',
    warehouse: 'w1',
    subProduct: {
      _id: 'sp1',
      sku: 'SKU-1',
      product: { _id: 'p1', name: 'Jack Daniels' },
    },
    size: { _id: 'sz1', size: '75cl' },
    currentQuantity: 10,
    reservedQuantity: 4,
    ...over,
  }) as WarehouseStockRow;

describe('row-utils derivations', () => {
  it('available = on-hand − reserved, never negative', () => {
    expect(availOf(row({}))).toBe(6);
    expect(availOf(row({ currentQuantity: 2, reservedQuantity: 9 }))).toBe(0);
  });

  it('prefers the server-computed status flag when present', () => {
    const r = row({
      currentQuantity: 100,
      flags: { status: 'low_stock' } as WarehouseStockRow['flags'],
    });
    expect(statusOf(r, 10)).toBe('low_stock');
  });

  it('falls back to local thresholds without flags', () => {
    expect(statusOf(row({ currentQuantity: 0 }))).toBe('out_of_stock');
    expect(statusOf(row({ currentQuantity: 8, reservedQuantity: 0 }), 10)).toBe(
      'low_stock'
    );
    expect(
      statusOf(row({ currentQuantity: 11, reservedQuantity: 0 }), 10)
    ).toBe('in_stock');
  });
});

describe('buildExportColumns', () => {
  it('has fixed numeric column positions', () => {
    const cols = buildExportColumns();
    const numericKeys = cols
      .map((c, i) => (c.numeric ? i : -1))
      .filter((i) => i >= 0);
    // On Hand, Reserved, Available are columns 7–9.
    expect(numericKeys).toEqual([7, 8, 9]);
  });

  it('status column honours a custom low-stock threshold', () => {
    const cols = buildExportColumns(2);
    const statusCol = cols.find((c) => c.key === 'status')!;
    expect(statusCol.value(row({ currentQuantity: 5, reservedQuantity: 0 }))).toBe(
      'In stock'
    );
    expect(statusCol.value(row({ currentQuantity: 2, reservedQuantity: 0 }))).toBe(
      'Low'
    );
    expect(statusCol.value(row({ currentQuantity: 0 }))).toBe('Out');
  });
});

describe('csvEscape / totals / context', () => {
  it('escapes commas, quotes and newlines per RFC-4180', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape(42)).toBe('42'); // numbers stringify — fine for CSV
  });

  it('builds footer totals cells', () => {
    const totals = { onHand: 30, reserved: 5, available: 25 };
    expect(totalsCellFor('product', 3, totals)).toBe('TOTAL · 3 lines');
    expect(totalsCellFor('onHand', 3, totals)).toBe(30);
    expect(totalsCellFor('reserved', 3, totals)).toBe(5);
    expect(totalsCellFor('available', 3, totals)).toBe(25);
    expect(totalsCellFor('sku', 3, totals)).toBe('');
  });

  it('composes the filter/search context note', () => {
    expect(contextNoteOf('', '')).toBe('');
    expect(contextNoteOf('low_out', '')).toBe(' · Low / Out only');
    expect(contextNoteOf('', 'jack')).toBe(' · Search: “jack”');
    expect(contextNoteOf('low_out', 'jack')).toBe(
      ' · Low / Out only · Search: “jack”'
    );
  });
});

describe('fileBaseOf', () => {
  it('uses the warehouse code with an ISO date stamp', () => {
    const base = fileBaseOf('MS', 'fallback-id');
    expect(base.startsWith('stock-MS-')).toBe(true);
    expect(base).toMatch(/stock-MS-\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to the id when no code exists', () => {
    const base = fileBaseOf(undefined, 'abc123');
    expect(base.startsWith('stock-abc123-')).toBe(true);
  });
});
