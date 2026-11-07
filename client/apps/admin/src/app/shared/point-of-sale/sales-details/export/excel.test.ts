import { describe, expect, it } from 'vitest';
import { getLineCellExcel, getGroupCellExcel } from './excel';
import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS } from '../constants';
import type { GroupRow, LineRow } from '../types';

const line = (over: Partial<LineRow> = {}): LineRow => ({
  orderId: 'o1', orderNumber: 'R1', receiptNumber: 'A1', date: '2026-09-28',
  cashier: 'Ada', product: 'Wine', variant: '', category: 'Wine',
  subcategory: '', brand: '', qty: 2, unitPrice: 500, discount: 0,
  subtotal: 1000, gross: 1200, grossShare: 1000, returnedValue: 0,
  costPrice: 600, hasCost: true, profit: 400,
  paymentMethod: 'cash', splitPayment: false, paymentShares: [],
  isVoided: false, warehouse: 'Main',
  ...over,
});

const group = (over: Partial<GroupRow> = {}): GroupRow => ({
  key: 'Wine', qty: 2, gross: 1000, returns: 0, discount: 0, revenue: 1000,
  costedRevenue: 1000, uncostedRevenue: 0, profit: 400, margin: 40,
  lineCount: 1, orderCount: 1, share: 100,
  ...over,
});

describe('variant identity survives the excel export', () => {
  // DRI-6 extension: the sheet must carry the server's composed variant string
  // (colour/option identity) verbatim — DRI-7/DRI-10 seed shapes: a retail
  // product sold as two same-size colour variants next to a legacy beverage
  // line with no variant identity at all. The excel cell getter does not
  // compose or re-format the label; it re-emits it.
  // Excel guards against a variant column ever dropping from the column list,
  // which is how the colour identity would actually get lost on export.
  const gownEmerald = line({ product: 'Skyline Ankara Gown', variant: 'M · Emerald' });
  const gownAmber = line({ product: 'Skyline Ankara Gown', variant: 'M · Amber' });
  const legacyLager = line({ product: 'Lakeside Craft Lager 330ml', variant: '' });

  it('the line sheet column list always offers the variant column', () => {
    expect(LINE_EXPORT_COLS.some((c) => c.key === 'variant')).toBe(true);
  });

  it('the group sheet column list always offers the variant-bearing key', () => {
    expect(GROUP_EXPORT_COLS.some((c) => c.key === 'key')).toBe(true);
  });

  it('the variant cell keeps colour identity on the excel line export', () => {
    // Two colour variants of one product must remain distinguishable rows.
    expect(getLineCellExcel(gownEmerald, 'variant')).toBe('M · Emerald');
    expect(getLineCellExcel(gownAmber, 'variant')).toBe('M · Amber');
  });

  it('a no-variant legacy beverage row keeps its empty variant cell', () => {
    // Unchanged shape: a legacy line renders the empty string it always did —
    // never a fabricated placeholder like 'n/a' or '—' in the sheet.
    expect(getLineCellExcel(legacyLager, 'variant')).toBe('');
  });

  it('grouped by product, each variant keeps its own sheet key', () => {
    expect(getGroupCellExcel(group({ key: 'Skyline Ankara Gown (M · Emerald)' }), 'key'))
      .toBe('Skyline Ankara Gown (M · Emerald)');
    expect(getGroupCellExcel(group({ key: 'Skyline Ankara Gown (M · Amber)' }), 'key'))
      .toBe('Skyline Ankara Gown (M · Amber)');
    expect(getGroupCellExcel(group({ key: 'Lakeside Craft Lager 330ml' }), 'key'))
      .toBe('Lakeside Craft Lager 330ml');
  });
});

describe('excel numbers reconcile the same way the strip does', () => {
  it('gross minus returns equals net on the sheet too', () => {
    const gross = Number(getLineCellExcel(line({ grossShare: 4000, returnedValue: 3000 }), 'gross'));
    const returns = Number(getLineCellExcel(line({ grossShare: 4000, returnedValue: 3000 }), 'returns'));
    const net = Number(getLineCellExcel(line({ grossShare: 4000, returnedValue: 3000 }), 'net'));
    expect(gross - returns).toBeCloseTo(net, 2);
  });

  it('the group key cell is the sheet label, not a decorated value', () => {
    expect(getGroupCellExcel(group({ key: 'Wine' }), 'key')).toBe('Wine');
  });
});
