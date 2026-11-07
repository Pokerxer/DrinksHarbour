import { describe, expect, it } from 'vitest';
import { getLineCell, getGroupCell } from './csv';
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

describe('an exported report has to reconcile too', () => {
  // Without a Returns column the exported sheet carried gross and net and no way
  // to explain the gap between them, so the reconciliation the summary strip
  // now guarantees was lost the moment anyone opened the file.
  it('exports the line returns value', () => {
    expect(getLineCell(line({ returnedValue: 250 }), 'returns', 'csv')).toBe('250.00');
  });

  it('exports the group returns value', () => {
    expect(getGroupCell(group({ returns: 300 }), 'returns', 'csv')).toBe('300.00');
  });

  it('a line export of gross minus returns equals net', () => {
    const gross = Number(getLineCell(line({ grossShare: 4000, returnedValue: 3000, subtotal: 1000 }), 'gross', 'csv'));
    const returns = Number(getLineCell(line({ grossShare: 4000, returnedValue: 3000, subtotal: 1000 }), 'returns', 'csv'));
    const net = Number(getLineCell(line({ grossShare: 4000, returnedValue: 3000, subtotal: 1000 }), 'net', 'csv'));
    expect(gross - returns).toBeCloseTo(net, 2);
  });
});

describe('margin is never a fabricated number', () => {
  // A line with no cost basis reported "0" margin, which reads as a real
  // measurement: the tenant sold something at a loss. It is a gap in the data.
  it('an uncosted line reports no margin instead of zero', () => {
    expect(getLineCell(line({ hasCost: false, costPrice: 0, profit: 0 }), 'margin', 'csv')).toBe('n/a');
    expect(getLineCell(line({ hasCost: false, costPrice: 0, profit: 0 }), 'margin', 'pdf')).toBe('—');
  });

  it('a costed line reports its real margin', () => {
    expect(getLineCell(line({ profit: 400, subtotal: 1000 }), 'margin', 'csv')).toBe('40.0%');
  });

  it('a genuine loss reports a negative margin, not a blank', () => {
    expect(getLineCell(line({ profit: -400, subtotal: 1000 }), 'margin', 'csv')).toBe('-40.0%');
  });

  it('a zero-revenue line reports no margin rather than dividing by zero', () => {
    expect(getLineCell(line({ profit: 0, subtotal: 0 }), 'margin', 'csv')).toBe('n/a');
  });

  it('a group with no costed revenue reports no margin', () => {
    expect(getGroupCell(group({ profit: 0, costedRevenue: 0, revenue: 1000, margin: 0 }), 'margin', 'csv')).toBe('n/a');
  });

  it('a group reports the margin it computed on costed revenue', () => {
    expect(getGroupCell(group({ profit: 400, costedRevenue: 1000, revenue: 1000, margin: 40 }), 'margin', 'csv')).toBe('40.0%');
  });
});

describe('a split tender is visible in the export', () => {
  it('names every leg of a split receipt, not just the dominant one', () => {
    const cell = getLineCell(
      line({
        paymentMethod: 'card', splitPayment: true,
        paymentShares: [{ method: 'cash', amount: 2000 }, { method: 'card', amount: 8000 }],
      }),
      'payment', 'csv'
    );
    expect(cell).toMatch(/cash/i);
    expect(cell).toMatch(/card/i);
  });

  it('an unsplit receipt is not padded with extra detail', () => {
    // CSV quotes the field; PDF does not. Neither adds a split breakdown.
    expect(getLineCell(line({ paymentMethod: 'cash' }), 'payment', 'csv')).toBe('"Cash"');
    expect(getLineCell(line({ paymentMethod: 'cash' }), 'payment', 'pdf')).toBe('Cash');
  });
});

describe('variant identity survives every export format', () => {
  // DRI-6 extension: the report surfaces must carry the server's composed
  // variant string (colour/option identity) verbatim — DRI-7/DRI-10 seed shapes —
  // a retail product sold as two same-size colour variants next to a legacy
  // beverage line with no variant identity at all. Exports re-emit `item.variant`
  // via the shared `getLineCell`; nothing here composes or re-formats a label.
  const gownEmerald = line({ product: 'Skyline Ankara Gown', variant: 'M · Emerald' });
  const gownAmber = line({ product: 'Skyline Ankara Gown', variant: 'M · Amber' });
  const legacyLager = line({ product: 'Lakeside Craft Lager 330ml', variant: '' });

  it('the variant column keeps colour identity in csv and pdf line exports', () => {
    // CSV quotes the whole field; PDF emits it verbatim. A colour variant that
    // collapsed to bare product name would make the two variants unreconcilable.
    expect(getLineCell(gownEmerald, 'variant', 'csv')).toBe('"M · Emerald"');
    expect(getLineCell(gownAmber, 'variant', 'csv')).toBe('"M · Amber"');
    expect(getLineCell(gownEmerald, 'variant', 'pdf')).toBe('M · Emerald');
    expect(getLineCell(gownAmber, 'variant', 'pdf')).toBe('M · Amber');
  });

  it('a no-variant legacy beverage row keeps its export shape byte-for-byte', () => {
    // Empty variant: csv emits the empty (quoted) string it always did; pdf
    // renders the em-dash placeholder instead of a dangling blank cell. Both
    // unchanged — legacy beverage exports must not acquire a new shape.
    expect(getLineCell(legacyLager, 'variant', 'csv')).toBe('""');
    expect(getLineCell(legacyLager, 'variant', 'pdf')).toBe('—');
  });

  it('grouped by product, each variant keeps its own export key', () => {
    // The grouped table/export keys a retail variant as `product (variant)`,
    // so two colour variants of one product stay two rows — while a no-variant
    // legacy product keys as the bare product name with no dangling brackets.
    expect(getGroupCell(group({ key: 'Skyline Ankara Gown (M · Emerald)' }), 'key', 'csv'))
      .toBe('"Skyline Ankara Gown (M · Emerald)"');
    expect(getGroupCell(group({ key: 'Skyline Ankara Gown (M · Emerald)' }), 'key', 'pdf'))
      .toBe('Skyline Ankara Gown (M · Emerald)');
    expect(getGroupCell(group({ key: 'Lakeside Craft Lager 330ml' }), 'key', 'pdf'))
      .toBe('Lakeside Craft Lager 330ml');
  });
});
