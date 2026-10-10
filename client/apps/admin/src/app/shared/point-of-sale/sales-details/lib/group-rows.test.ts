import { describe, expect, it } from 'vitest';
import { groupRows } from './group-rows';
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

describe('a group reconciles the same way the strip does', () => {
  it('gross minus returns equals revenue', () => {
    const [g] = groupRows(
      [line({ grossShare: 4000, returnedValue: 3000, subtotal: 1000 })],
      'product', 'revenue', 'desc'
    );
    expect(g.gross - g.returns).toBeCloseTo(g.revenue, 2);
  });

  it('accumulates the return value across the group\'s lines', () => {
    const [g] = groupRows(
      [
        line({ grossShare: 1000, returnedValue: 400, subtotal: 600 }),
        line({ orderId: 'o2', grossShare: 2000, returnedValue: 500, subtotal: 1500 }),
      ],
      'product', 'revenue', 'desc'
    );
    expect(g.gross).toBe(3000);
    expect(g.returns).toBe(900);
    expect(g.revenue).toBe(2100);
    expect(g.gross - g.returns).toBeCloseTo(g.revenue, 2);
  });

  it('margin is measured against the group\'s costed revenue', () => {
    const [g] = groupRows(
      [
        line({ grossShare: 1000, returnedValue: 0, subtotal: 1000, costPrice: 600, profit: 400, hasCost: true }),
        line({ orderId: 'o2', grossShare: 1000, returnedValue: 0, subtotal: 1000, costPrice: 0, profit: 0, hasCost: false }),
      ],
      'product', 'revenue', 'desc'
    );
    expect(g.costedRevenue).toBe(1000);
    expect(g.uncostedRevenue).toBe(1000);
    expect(g.margin).toBeCloseTo(40, 5);
  });

  it('share is a percentage of the filtered revenue and the shares sum to 100', () => {
    const rows = [
      line({ product: 'Wine', subtotal: 750, grossShare: 750, returnedValue: 0 }),
      line({ product: 'Beer', orderId: 'o2', subtotal: 250, grossShare: 250, returnedValue: 0 }),
    ];
    const groups = groupRows(rows, 'product', 'revenue', 'desc');
    expect(groups.map((g) => Math.round(g.share))).toEqual([75, 25]);
    expect(groups.reduce((n, g) => n + g.share, 0)).toBeCloseTo(100, 5);
  });

  it('counts each receipt once per group however many lines it has', () => {
    const [g] = groupRows([line(), line(), line({ orderId: 'o2' })], 'product', 'revenue', 'desc');
    expect(g.orderCount).toBe(2);
    expect(g.lineCount).toBe(3);
  });

  it('groups a split receipt under the method that took the most money', () => {
    const [g] = groupRows(
      [line({ paymentMethod: 'card', splitPayment: true,
        paymentShares: [{ method: 'cash', amount: 2000 }, { method: 'card', amount: 8000 }] })],
      'payment_method', 'revenue', 'desc'
    );
    // The dominant method, so the tender's largest leg is not hidden.
    expect(g.key).toMatch(/card/i);
  });
});
