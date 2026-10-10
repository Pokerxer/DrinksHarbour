import { describe, expect, it } from 'vitest';
import { summariseLines } from './summarise-lines';
import type { LineRow } from '../types';

const line = (over: Partial<LineRow> = {}): LineRow => ({
  orderId: 'o1', orderNumber: 'R1', receiptNumber: 'A1', date: '2026-09-28',
  cashier: 'Ada', product: 'Wine', variant: '', category: 'Wine',
  subcategory: '', brand: '', qty: 2, unitPrice: 500, discount: 0,
  subtotal: 1000, gross: 1000, grossShare: 1000, returnedValue: 0,
  costPrice: 600, hasCost: true, profit: 400,
  paymentMethod: 'cash', splitPayment: false, paymentShares: [],
  isVoided: false, warehouse: 'Main',
  ...over,
});

describe('the strip has to add up', () => {
  // The card row showed Gross with the sub-label "− discount" and Net Revenue
  // labelled "after discounts", but the server also deducts returns from each
  // line's net sales. The gap between the two cards was therefore larger than
  // the discount and nothing reported the difference, so the row could not be
  // made to reconcile by any arithmetic the user tried.
  it('gross minus returns equals net revenue', () => {
    const s = summariseLines([
      line({ grossShare: 1000, returnedValue: 0, subtotal: 1000, profit: 400, costPrice: 600 }),
      line({ orderId: 'o2', grossShare: 4000, returnedValue: 3000, subtotal: 1000, profit: -100, costPrice: 1100 }),
    ]);
    expect(s.gross - s.returns).toBeCloseTo(s.revenue, 2);
  });

  it('a discount is disclosed, not subtracted twice', () => {
    // The net figure already has the discount taken out of it. Presenting the
    // discount as a step between gross and net asked the user to subtract it a
    // second time.
    const s = summariseLines([
      line({ grossShare: 900, returnedValue: 0, subtotal: 900, discount: 100, gross: 1000 }),
    ]);
    expect(s.discount).toBe(100);
    expect(s.gross).toBe(900);
    expect(s.revenue).toBe(900);
  });

  it('an empty list is zero rather than NaN', () => {
    expect(summariseLines([])).toMatchObject({ gross: 0, revenue: 0, profit: 0, orders: 0, avgOrder: 0 });
  });

  it('counts a receipt once however many lines it has', () => {
    const s = summariseLines([line(), line(), line({ orderId: 'o2' })]);
    expect(s.orders).toBe(2);
    expect(s.lines).toBe(3);
  });

  it('average order value is net revenue per receipt', () => {
    const s = summariseLines([
      line({ orderId: 'o1', subtotal: 1000, grossShare: 1000, returnedValue: 0 }),
      line({ orderId: 'o2', subtotal: 3000, grossShare: 4000, returnedValue: 1000 }),
    ]);
    expect(s.avgOrder).toBe(2000);
  });
});

describe('margin is measured against the revenue it can be measured on', () => {
  // An uncosted line contributes no profit. Dividing total profit by *total*
  // revenue quietly charged those lines a 0% margin, so the reported margin
  // read lower than the margin actually earned on the stock that was costed.
  it('excludes uncosted revenue from the margin denominator', () => {
    const s = summariseLines([
      line({ grossShare: 1000, returnedValue: 0, subtotal: 1000, costPrice: 600, profit: 400, hasCost: true }),
      line({ orderId: 'o2', grossShare: 1000, returnedValue: 0, subtotal: 1000, costPrice: 0, profit: 0, hasCost: false }),
    ]);
    expect(s.costedRevenue).toBe(1000);
    expect(s.uncostedRevenue).toBe(1000);
    expect(s.margin).toBeCloseTo(40, 5);
  });

  it('reports the uncosted revenue rather than hiding it', () => {
    const s = summariseLines([line({ hasCost: false, costPrice: 0, profit: 0, subtotal: 750 })]);
    expect(s.uncostedRevenue).toBe(750);
  });

  it('margin is zero, not NaN, when nothing is costed', () => {
    const s = summariseLines([line({ hasCost: false, costPrice: 0, profit: 0, subtotal: 500 })]);
    expect(s.margin).toBe(0);
  });

  it('a fully costed report has no uncosted revenue', () => {
    const s = summariseLines([line({ costPrice: 600, profit: 400, subtotal: 1000 })]);
    expect(s.uncostedRevenue).toBe(0);
    expect(s.margin).toBeCloseTo(40, 5);
  });

  it('a loss on a costed line lowers the margin below its own rate', () => {
    const s = summariseLines([line({ costPrice: 1400, profit: -400, subtotal: 1000, hasCost: true })]);
    expect(s.margin).toBeCloseTo(-40, 5);
  });
});
