// app/shared/purchases/purchases-analytics-finite.test.ts
//
// Every value that reaches a chart must be a finite number.
//
// This exists because of a console warning that gave no clue where it came from:
//
//   Received NaN for the `width` attribute  (purchases-analytics-charts.tsx,
//                                            at the Bar's <LabelList>)
//
// The chain is worth writing down, because none of it names the bug. recharts
// computes a horizontal bar's width as `scale(value) - scale(base)` (Bar.js), then
// hands that rect's width to the label as a viewBox. `Text` spreads its props
// through `filterProps` onto the `<text>` element, so a NaN bar width surfaces as
// a NaN `width` on a *text* node — four components away from the bar that caused
// it. A NaN anywhere in the data poisons the scale, and from there every bar and
// every label on the chart.
//
// So the guard belongs here, at the boundary where the numbers are made.

import { describe, it, expect } from 'vitest';
import {
  aggregateMeasure,
  lineTax,
  lineUntaxed,
} from './purchases-analytics-helpers';
import type { POItem } from './types';

const item = (over: Partial<POItem> = {}): POItem =>
  ({
    subProductId: 'sp1',
    productName: 'Product',
    sku: 'SKU-1',
    quantity: 4,
    packSize: 1,
    packQty: 1,
    unitPrice: 2500,
    packPrice: 2500,
    receivedQty: 4,
    type: 'goods',
    ...over,
  }) as POItem;

const isFinite_ = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

describe('line maths', () => {
  it('treats a null unitCost as absent rather than as zero', () => {
    // The server keeps unitCost on every line (default 0), so the null branch is
    // the legacy shape. Both orderings have to survive.
    expect(lineUntaxed(item({ unitCost: null as never, unitPrice: 2500 }))).toBe(10000);
    expect(lineUntaxed(item({ unitCost: 3000, unitPrice: 2500 }))).toBe(12000);
  });

  it('survives nulls in every field it multiplies', () => {
    expect(lineUntaxed(item({ unitCost: null as never, unitPrice: null as never }))).toBe(0);
    expect(lineUntaxed(item({ quantity: null as never }))).toBe(0);
    expect(lineTax(item({ unitCost: null as never, unitPrice: null as never }))).toBe(0);
  });

  it('does not turn a null taxRate into a NaN line', () => {
    expect(lineTax(item({ taxRate: null as never }))).toBe(0);
    expect(lineTax(item({ taxRate: 7.5 }))).toBe(750);
  });

  it('treats a blank field as absent, not as zero', () => {
    // A form post sends '' for an untouched price, and that is valid JSON. With
    // `??` the blank sailed through, `'' * 4` was 0, and the line contributed
    // nothing — a blank unitCost silently masked a perfectly good unitPrice and
    // the purchase value went unrecorded.
    expect(lineUntaxed(item({ unitCost: '' as never, unitPrice: 2500 }))).toBe(10000);
    expect(lineUntaxed(item({ unitPrice: '' as never, unitCost: 3000 }))).toBe(12000);
    expect(lineUntaxed(item({ quantity: '' as never }))).toBe(0);
  });

  it('reads a numeric string as a number', () => {
    expect(lineUntaxed(item({ unitCost: '2500' as never }))).toBe(10000);
    expect(lineUntaxed(item({ quantity: '4' as never }))).toBe(10000);
  });

  it('keeps a real zero unitCost instead of falling through to unitPrice', () => {
    // Free-of-charge lines exist. Choosing the fallback by position rather than by
    // falsiness is what makes that safe — a `||` here would price them at 2500.
    expect(lineUntaxed(item({ unitCost: 0, unitPrice: 2500 }))).toBe(0);
  });

  it('never returns NaN for a null-shaped line', () => {
    // Deliberately not Partial<POItem>: these carry nulls and blank strings, which
    // the declared type forbids but a real API body can still contain.
    type Loose = Record<string, unknown>;
    const shapes: Loose[] = [
      { unitCost: null, unitPrice: null, quantity: null },
      { unitCost: '' },
      { quantity: '' },
      { taxRate: '' },
      { unitCost: '   ' },
    ];
    for (const shape of shapes) {
      const line = item(shape as Partial<POItem>);
      expect(isFinite_(lineUntaxed(line)), `${JSON.stringify(shape)} untaxed`).toBe(true);
      expect(isFinite_(lineTax(line)), `${JSON.stringify(shape)} tax`).toBe(true);
    }
  });
});

describe('aggregateMeasure', () => {
  const measures = [
    'total_cost',
    'untaxed_total',
    'tax_total',
    'count',
    'avg_order',
    'product_qty',
    'received_qty',
    'line_count',
  ] as const;

  const toBase = (amount: number) => amount;

  it('returns a finite number for every measure and every hostile line', () => {
    // aggregateMeasure takes {item, currency} wrappers, not bare lines.
    const lines = [
      item(),
      item({ unitCost: null as never, unitPrice: null as never }),
      item({ quantity: 0 }),
      item({ receivedQty: null as never }),
      item({ taxRate: null as never }),
    ].map(i => ({ item: i, currency: 'NGN' }));
    for (const measure of measures) {
      const value = aggregateMeasure([{ _id: 'o1' } as never], lines as never[], measure, toBase);
      expect(isFinite_(value), `${measure} produced ${value}`).toBe(true);
    }
  });

  it('returns 0 for no lines rather than dividing by zero', () => {
    for (const measure of measures) {
      const value = aggregateMeasure([], [], measure, toBase);
      expect(value, `${measure} on empty input`).toBe(0);
    }
  });

  it('keeps avg_order finite when the order list is empty', () => {
    // The item-less fallback bucket in computeGroupData parks orders with no lines
    // into one group, so this pairing really does occur.
    expect(aggregateMeasure([], [{ item: item(), currency: 'NGN' }] as never[], 'avg_order', toBase)).toBe(0);
  });
});
