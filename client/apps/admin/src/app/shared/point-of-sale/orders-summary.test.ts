import { describe, expect, test } from 'vitest';
import { summariseOrders, orderStatus } from './orders-summary';
import type { NetSalesOrder } from './report-totals';

const order = (over: Partial<NetSalesOrder> = {}): NetSalesOrder => ({
  total: 10000,
  netSales: 10000,
  returnDeduction: 0,
  ...over,
});

describe('the cards have to add up', () => {
  // This is the defect: the page showed "Gross Sales" summed from `total` (which
  // includes gratuities and cash rounding) beside "Refunds" that counted only
  // cash, so Gross − Refunds never equalled the Net Revenue shown next to it.
  test('gross sales minus returns equals net revenue', () => {
    const s = summariseOrders([
      order({ total: 10000, netSales: 10000, returnDeduction: 0 }),
      order({ total: 4000, netSales: 1000, returnDeduction: 3000 }),
    ]);
    expect(s.grossSales - s.returns).toBeCloseTo(s.netRevenue, 2);
  });

  test('a gratuity is not sales', () => {
    // 10,000 of goods and 2,000 handed to the bar staff is a 10,000 sale that
    // collected 12,000. Counting the tip as revenue overstated the day by the
    // amount the staff earned.
    const s = summariseOrders([order({ total: 12000, netSales: 10000, tipAmount: 2000 })]);
    expect(s.grossSales).toBe(10000);
    expect(s.tips).toBe(2000);
    expect(s.netRevenue).toBe(10000);
  });

  test('cash rounding is not sales either', () => {
    const s = summariseOrders([order({ total: 10005, netSales: 10000, roundingAmount: 5 })]);
    expect(s.grossSales).toBe(10000);
    expect(s.rounding).toBe(5);
  });

  test('stock returned through Sales is a return, not a cash refund', () => {
    // No cash left the till, but the goods are gone from the shelf and must
    // come off sales. Counting only cash refunds overstated what the bar kept.
    const s = summariseOrders([
      order({ total: 10000, netSales: 4000, returnDeduction: 6000, salesReturnValue: 6000 }),
    ]);
    expect(s.returns).toBe(6000);
    expect(s.cashRefunded).toBe(0);
    expect(s.netRevenue).toBe(4000);
  });

  test('a cash refund is a return, and the two figures stay separately visible', () => {
    const s = summariseOrders([
      order({ total: 10000, netSales: 7000, returnDeduction: 3000, totalRefunds: 3000 }),
    ]);
    expect(s.returns).toBe(3000);
    expect(s.cashRefunded).toBe(3000);
  });

  test('cash refunded never exceeds the value returned', () => {
    const s = summariseOrders([
      order({ total: 10000, netSales: 5000, returnDeduction: 5000, totalRefunds: 12000 }),
    ]);
    expect(s.cashRefunded).toBeLessThanOrEqual(s.returns);
  });

  test('a voided receipt contributes nothing at all', () => {
    const s = summariseOrders([
      order({ total: 5000, netSales: 5000, tipAmount: 500 }),
      order({ total: 9000, netSales: 9000, isVoided: true, tipAmount: 1000 }),
    ]);
    expect(s.grossSales).toBe(5000);
    expect(s.netRevenue).toBe(5000);
    expect(s.tips).toBe(500);
    expect(s.count).toBe(1);
    expect(s.voided).toBe(1);
  });

  test('an empty list is zero rather than NaN', () => {
    const s = summariseOrders([]);
    expect(s).toMatchObject({ count: 0, grossSales: 0, netRevenue: 0, avgOrder: 0 });
  });

  test('average order value is net revenue per live order', () => {
    const s = summariseOrders([
      order({ netSales: 10000 }),
      order({ netSales: 20000, isVoided: true }),
      order({ netSales: 3000, returnDeduction: 1000 }),
    ]);
    expect(s.avgOrder).toBe(6500);
  });
});

describe('status is decided on the same basis it is displayed in', () => {
  // returnDeduction is a commercial figure and `total` is a tender figure. On a
  // receipt with a gratuity they can never be equal, so a fully returned
  // receipt was labelled "Part. Returned" and hid a full return.
  const full = order({ total: 12000, netSales: 0, returnDeduction: 10000, tipAmount: 2000 });

  test('a fully returned receipt is fully returned, tip or no tip', () => {
    expect(orderStatus(full)).toBe('returned');
  });

  test('a partly returned receipt is partly returned', () => {
    expect(orderStatus(order({ netSales: 4000, returnDeduction: 6000 }))).toBe('part-returned');
  });

  test('an intact receipt is paid', () => {
    expect(orderStatus(order({ netSales: 10000, returnDeduction: 0 }))).toBe('paid');
  });

  test('a voided receipt is voided, whatever else it carries', () => {
    expect(orderStatus(order({ isVoided: true, returnDeduction: 10000 }))).toBe('voided');
  });
});
