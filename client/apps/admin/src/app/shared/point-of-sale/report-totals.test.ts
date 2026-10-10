import { describe, expect, it } from 'vitest';
import {
  cashRefunded,
  countCustomers,
  isWalkIn,
  isVoided,
  lineCost,
  lineNetSales,
  netQuantity,
  netSales,
  returnDeduction,
  roundingAmount,
  taxCollected,
  tipAmount,
  totalDiscount,
  type ReportOrder,
} from './report-totals';

const order = (over: Partial<ReportOrder> = {}): ReportOrder => ({
  _id: 'o1',
  total: 1000,
  paymentMethod: 'cash',
  placedAt: '2026-09-29T10:00:00.000Z',
  createdAt: '2026-09-29T10:00:00.000Z',
  items: [{ name: 'A', quantity: 1, priceAtPurchase: 1000, itemSubtotal: 1000 }],
  ...over,
});

describe('netSales', () => {
  it('preserves an authoritative zero instead of re-deriving it', () => {
    expect(netSales(order({ total: 1000, netSales: 0, refunds: [{ totalRefunded: 1000 }] }))).toBe(0);
  });

  it('does not subtract refunds twice when the server sent both figures', () => {
    expect(netSales(order({ total: 1000, netSales: 600, returnDeduction: 400 }))).toBe(600);
  });

  it('is zero for a voided receipt', () => {
    expect(netSales(order({ total: 1000, isVoided: true }))).toBe(0);
    expect(netSales(order({ total: 1000, status: 'voided' }))).toBe(0);
    expect(netSales(order({ total: 1000, status: 'hold' }))).toBe(0);
    expect(netSales(order({ total: 1000, status: 'cancelled' }))).toBe(0);
  });

  it('falls back to gross minus deduction for a legacy order', () => {
    expect(netSales(order({ total: 1000, refunds: [{ totalRefunded: 250 }] }))).toBe(750);
  });
});

describe('gratuity and rounding are not product income', () => {
  it('keeps a tip out of commercial sales but counts it in cash collected', () => {
    const o = order({ total: 1300, netSales: 1100, grossRevenue: 1100, netCollections: 1300, tipAmount: 200 });
    expect(netSales(o)).toBe(1100);
    expect(tipAmount(o)).toBe(200);
  });

  it('prefers the server total when the screen also sends a raw field', () => {
    expect(tipAmount(order({ tipAmount: 200, totalTips: 210 }))).toBe(210);
    expect(tipAmount(order({ tipAmount: 200 }))).toBe(200);
    expect(tipAmount(order())).toBe(0);
  });

  it('reports rounding separately from the tip', () => {
    expect(roundingAmount(order({ roundingAmount: 3, totalRounding: 3 }))).toBe(3);
    expect(roundingAmount(order())).toBe(0);
  });
});

describe('returns and refunds', () => {
  it('deduction is never double-counted', () => {
    expect(returnDeduction(order({ netSales: 600, returnDeduction: 400, refunds: [{ totalRefunded: 400 }] }))).toBe(400);
  });

  it('falls back to summing refunds on a legacy order', () => {
    expect(returnDeduction(order({ refunds: [{ totalRefunded: 100 }, { totalRefunded: 50 }] }))).toBe(150);
  });

  it('excludes Sales stock returns from cash refunded', () => {
    const o = order({
      refunds: [
        { source: 'sales', totalRefunded: 0 },
        { source: 'pos', totalRefunded: 220 },
      ],
    });
    expect(cashRefunded(o)).toBe(220);
  });

  it('prefers the server cash figure when present', () => {
    expect(cashRefunded(order({ totalRefunds: 220, refunds: [] }))).toBe(220);
  });
});

describe('discounts', () => {
  it('counts both the receipt footer and the line discounts', () => {
    const o = order({
      discountTotal: 50,
      lineDiscountTotal: 125,
      items: [{ name: 'A', quantity: 1, priceAtPurchase: 800, itemSubtotal: 700, discountAmount: 100 }],
    });
    expect(totalDiscount(o)).toBe(175);
  });

  it('derives line discounts from the lines when the server did not send a total', () => {
    const o = order({
      discountTotal: 50,
      items: [
        { name: 'A', quantity: 1, priceAtPurchase: 800, itemSubtotal: 700, discountAmount: 100 },
        { name: 'B', quantity: 1, priceAtPurchase: 300, itemSubtotal: 300, discountAmount: 25 },
      ],
    });
    expect(totalDiscount(o)).toBe(175);
  });

  it('is zero for a receipt with no discounts', () => {
    expect(totalDiscount(order())).toBe(0);
  });
});

describe('tax', () => {
  it('reads the order-level figure when present', () => {
    expect(taxCollected(order({ taxAmount: 100 }))).toBe(100);
  });

  it('sums line tax when the order figure is withheld', () => {
    const o = order({
      items: [
        { name: 'A', quantity: 1, priceAtPurchase: 1000, itemSubtotal: 1000, taxAmount: 75 },
      ],
    });
    expect(taxCollected(o)).toBe(75);
  });
});

describe('profit cost basis', () => {
  it('prefers the cost paid at sale over today\'s cost', () => {
    const line = { name: 'A', quantity: 1, priceAtPurchase: 1000, itemSubtotal: 1000, costPriceAtPurchase: 300, sizeCostPrice: 450 };
    expect(lineCost(line)).toBe(300);
  });

  it('falls back to the current cost for a legacy line with no snapshot', () => {
    const line = { name: 'A', quantity: 1, priceAtPurchase: 1000, itemSubtotal: 1000, sizeCostPrice: 450 };
    expect(lineCost(line)).toBe(450);
  });

  it('is zero for a line that was never costed, rather than guessing', () => {
    expect(lineCost({ name: 'A', quantity: 1, priceAtPurchase: 1000, itemSubtotal: 1000 })).toBe(0);
  });
});

describe('line revenue after returns', () => {
  it('uses the server net figure and net quantity', () => {
    const line = { name: 'A', quantity: 3, priceAtPurchase: 1000, itemSubtotal: 1000, netSales: 600, netQuantity: 2 };
    expect(lineNetSales(line)).toBe(600);
    expect(netQuantity(line)).toBe(2);
  });

  it('falls back to the gross line for a legacy line', () => {
    const line = { name: 'A', quantity: 3, priceAtPurchase: 1000, itemSubtotal: 1000 };
    expect(lineNetSales(line)).toBe(1000);
    expect(netQuantity(line)).toBe(3);
  });
});

describe('customer counting', () => {
  it('does not collapse every walk-in into one customer', () => {
    const orders = [
      order({ _id: 'a', customer: { firstName: 'Walk-in', lastName: 'Customer', phone: '' } }),
      order({ _id: 'b', customer: { firstName: 'Walk-in', lastName: 'Customer', phone: '' } }),
      order({ _id: 'c', customer: { firstName: 'Walk-in', lastName: 'Customer', phone: '' } }),
    ];
    const result = countCustomers(orders);
    expect(result.unique).toBe(0);
    expect(result.walkIn).toBe(3);
  });

  it('counts registered customers by id, not by display name', () => {
    const orders = [
      order({ _id: 'a', customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c1' } }),
      order({ _id: 'b', customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c1' } }),
      order({ _id: 'c', customer: { firstName: 'Ada', lastName: 'Nwosu', customerId: 'c2' } }),
    ];
    const result = countCustomers(orders);
    expect(result.unique).toBe(2);
    expect(result.walkIn).toBe(0);
  });

  it('treats a phone number as an identity even without a customer record', () => {
    const orders = [
      order({ _id: 'a', customer: { firstName: 'Sam', lastName: 'Ali', phone: '0803' } }),
      order({ _id: 'b', customer: { firstName: 'Sam', lastName: 'Ali', phone: '0803' } }),
    ];
    const result = countCustomers(orders);
    expect(result.unique).toBe(1);
    expect(result.walkIn).toBe(0);
  });

  it('treats a missing customer object as a walk-in', () => {
    expect(isWalkIn(order())).toBe(true);
    expect(isWalkIn(order({ customer: null }))).toBe(true);
    expect(isWalkIn(order({ customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c1' } }))).toBe(false);
  });
});

describe('void detection', () => {
  it('recognises both the flag and the status', () => {
    expect(isVoided(order({ isVoided: true }))).toBe(true);
    expect(isVoided(order({ status: 'voided' }))).toBe(true);
    expect(isVoided(order({ status: 'confirmed' }))).toBe(false);
  });
});
