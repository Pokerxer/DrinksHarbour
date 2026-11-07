import { describe, expect, it } from 'vitest';
import { flattenOrders } from './flatten-orders';
import { groupRows } from './group-rows';
import type { PosOrder } from '../types';

const order = (over: Partial<PosOrder> = {}): PosOrder => ({
  _id: 'receipt1', total: 200, paymentMethod: 'cash',
  createdAt: '2026-09-28', placedAt: '2026-09-28',
  items: [{ name: 'Wine', quantity: 4, priceAtPurchase: 50,
    itemSubtotal: 200, sizeCostPrice: 30, netQuantity: 2, netSales: 100 }],
  ...over,
});

describe('returns are taken off the line, not the receipt', () => {
  it('uses remaining quantity and net value for revenue, cost and profit', () => {
    expect(flattenOrders([order()])[0]).toMatchObject({
      qty: 2, subtotal: 100, gross: 200, costPrice: 60, profit: 40,
    });
  });

  it('preserves zero after a full return instead of falling back to gross', () => {
    const returned = order({ items: order().items!.map(i => ({ ...i, netQuantity: 0, netSales: 0 })) });
    expect(flattenOrders([returned])[0]).toMatchObject({
      qty: 0, subtotal: 0, gross: 200, costPrice: 0, profit: 0,
    });
  });
});

describe('profit uses the cost the stock was bought for, not today\'s cost', () => {
  // The Size model's costPrice is *current*. Profit built on it rewrote history
  // every time a cost price was edited: raising a bottle's cost today silently
  // reduced the margin on a sale made last month. The server snapshots the cost
  // at purchase time precisely so this cannot happen.
  it('a cost raised after the sale does not rewrite that sale\'s profit', () => {
    const [row] = flattenOrders([order({
      items: [{ name: 'Wine', quantity: 4, priceAtPurchase: 50, itemSubtotal: 200,
        netQuantity: 2, netSales: 100,
        costPriceAtPurchase: 25,   // what it cost when sold
        sizeCostPrice: 40,         // what it costs now
      }],
    })]);
    expect(row.costPrice).toBe(50);   // 25/unit x 2
    expect(row.profit).toBe(50);
  });

  it('falls back to the current cost only for a legacy line with no snapshot', () => {
    const [row] = flattenOrders([order({
      items: [{ name: 'Wine', quantity: 4, priceAtPurchase: 50, itemSubtotal: 200,
        netQuantity: 2, netSales: 100, sizeCostPrice: 30 }],
    })]);
    expect(row.costPrice).toBe(60);
  });

  it('flags a line that carries no cost at all rather than guessing a margin', () => {
    const [row] = flattenOrders([order({
      items: [{ name: 'Wine', quantity: 2, priceAtPurchase: 50, itemSubtotal: 100,
        netQuantity: 2, netSales: 100 }],
    })]);
    expect(row.hasCost).toBe(false);
    // Profit is not the full sale value: an unknown cost is a gap, not 100% margin.
    expect(row.profit).toBe(0);
  });

  it('a zero-cost line is a gap, not a free product', () => {
    const [row] = flattenOrders([order({
      items: [{ name: 'Wine', quantity: 2, priceAtPurchase: 50, itemSubtotal: 100,
        netQuantity: 2, netSales: 100, costPriceAtPurchase: 0 }],
    })]);
    expect(row.hasCost).toBe(false);
  });

  it('marks a costed line as costed', () => {
    expect(flattenOrders([order()])[0].hasCost).toBe(true);
  });
});

describe('a split receipt is not one payment method', () => {
  it('attributes the receipt to the method that took the most money', () => {
    const [row] = flattenOrders([order({
      paymentMethod: 'cash',
      paymentDetails: {
        splitPayments: [
          { method: 'cash', amount: 2000 },
          { method: 'card', amount: 8000 },
        ],
      },
    })]);
    expect(row.paymentMethod).toBe('card');
    expect(row.splitPayment).toBe(true);
  });

  it('keeps every tender visible so a split is not hidden', () => {
    const [row] = flattenOrders([order({
      paymentMethod: 'cash',
      paymentDetails: {
        splitPayments: [
          { method: 'cash', amount: 2000 },
          { method: 'card', amount: 8000 },
        ],
      },
    })]);
    expect(row.paymentShares).toEqual([
      { method: 'cash', amount: 2000 },
      { method: 'card', amount: 8000 },
    ]);
  });

  it('an unsplit receipt is not marked as a split', () => {
    const [row] = flattenOrders([order()]);
    expect(row.splitPayment).toBe(false);
    expect(row.paymentShares).toEqual([]);
  });
});

describe('variant identity survives flatten and grouping end-to-end', () => {
  // DRI-6 extension, DRI-7/DRI-10 seed shapes: one retail receipt carrying two
  // same-size colour lines of one gown next to a legacy beverage line with no
  // variant. The server-composed variant string must survive flatten verbatim
  // and keep the two retail variants as separate groups by product — with no
  // volume/ml assumption anywhere in the chain.
  const receipt = order({
    items: [
      { name: 'Skyline Ankara Gown', variant: 'M · Emerald', quantity: 2,
        priceAtPurchase: 22000, itemSubtotal: 44000, netQuantity: 2, netSales: 44000,
        sizeCostPrice: 12000 },
      { name: 'Skyline Ankara Gown', variant: 'M · Amber', quantity: 1,
        priceAtPurchase: 24000, itemSubtotal: 24000, netQuantity: 1, netSales: 24000,
        sizeCostPrice: 12000 },
      { name: 'Lakeside Craft Lager 330ml', variant: '', quantity: 4,
        priceAtPurchase: 3500, itemSubtotal: 14000, netQuantity: 4, netSales: 14000,
        sizeCostPrice: 2200 },
    ],
  });

  it('the flattened line carries the variant string verbatim', () => {
    const rows = flattenOrders([receipt]);
    expect(rows.map((r) => r.variant)).toEqual(['M · Emerald', 'M · Amber', '']);
  });

  it('grouping by product keeps the two variants separate and the lager bare', () => {
    const rows = flattenOrders([receipt]);
    const grouped = groupRows(rows, 'product', 'revenue', 'desc');
    expect(grouped.map((g) => g.key)).toEqual([
      'Skyline Ankara Gown (M · Emerald)',
      'Skyline Ankara Gown (M · Amber)',
      'Lakeside Craft Lager 330ml',
    ]);
  });

  it('grouping a no-variant legacy line never renders a dangling marker', () => {
    const [row] = flattenOrders([order()]);
    const [g] = groupRows([row], 'product', 'revenue', 'desc');
    expect(g.key).toBe('Wine');
  });
});
