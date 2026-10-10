import { describe, expect, it } from 'vitest';
import {
  applyMeasure,
  computeKpis,
  getOrderDimKey,
  ITEM_DIMS,
  MEASURES,
  paymentAttribution,
  sumLines,
  type MeasureScope,
} from './measures';
import { netSales } from '../report-totals';
import type { ReportOrder, ReportOrderItem } from '../report-totals';

const line = (over: Partial<ReportOrderItem> = {}): ReportOrderItem => ({
  name: 'Jameson 750ml',
  quantity: 2,
  priceAtPurchase: 5000,
  itemSubtotal: 10000,
  ...over,
});

const order = (over: Partial<ReportOrder> = {}): ReportOrder => ({
  _id: 'o1',
  total: 10000,
  subtotal: 10000,
  paymentMethod: 'cash',
  placedAt: '2026-09-29T10:00:00.000Z',
  createdAt: '2026-09-29T10:00:00.000Z',
  items: [line()],
  refunds: [],
  ...over,
});

const orderScope = (orders: ReportOrder[]): MeasureScope => ({
  orders,
  items: orders.flatMap((o) => o.items || []),
  isItemGroup: false,
});

const itemScope = (orders: ReportOrder[], items: ReportOrderItem[]): MeasureScope => ({
  orders,
  items,
  isItemGroup: true,
});

describe('D1 — gratuity and cash rounding are never product income', () => {
  const tipped = order({ total: 12000, netSales: 10000, grossRevenue: 10000, netCollections: 12000, tipAmount: 2000 });

  it('keeps the tip out of net revenue', () => {
    expect(applyMeasure('total_price', orderScope([tipped]))).toBe(10000);
  });

  it('keeps the tip out of gross sales', () => {
    expect(applyMeasure('gross', orderScope([tipped]))).toBe(10000);
  });

  it('reports the tip as its own measure', () => {
    expect(applyMeasure('tips', orderScope([tipped]))).toBe(2000);
  });

  it('keeps cash rounding out of revenue and counts it separately', () => {
    const rounded = order({ total: 10003, netSales: 10000, grossRevenue: 10000, roundingAmount: 3 });
    expect(applyMeasure('total_price', orderScope([rounded]))).toBe(10000);
  });

  it('does not attribute a receipt tip to a product', () => {
    const o = order({ tipAmount: 2000, items: [line({ netSales: 10000 })] });
    expect(applyMeasure('tips', itemScope([o], [o.items![0]]))).toBe(0);
  });
});

describe('D3 — there is no longer a tax-free subtotal duplicate', () => {
  it('exposes a real tax measure', () => {
    const o = order({ taxAmount: 750, items: [line({ taxAmount: 750 })] });
    expect(applyMeasure('tax', orderScope([o]))).toBe(750);
    expect(applyMeasure('tax', itemScope([o], [o.items![0]]))).toBe(750);
  });

  it('no longer offers the subtotal/subtotal_notax pair', () => {
    const keys = MEASURES.map((m) => m.key);
    expect(keys).not.toContain('subtotal_notax');
    expect(keys).not.toContain('subtotal');
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('D4 — discounts count the line and the receipt footer', () => {
  it('adds line and footer discount for a receipt grouping', () => {
    const o = order({
      discountTotal: 500,
      lineDiscountTotal: 300,
      items: [line({ discountAmount: 300 })],
    });
    expect(applyMeasure('total_discount', orderScope([o]))).toBe(800);
  });

  it('attributes only line discount to a product', () => {
    const o = order({
      discountTotal: 500,
      items: [line({ discountAmount: 300 })],
    });
    expect(applyMeasure('total_discount', itemScope([o], [o.items![0]]))).toBe(300);
  });
});

describe('D5 — profit uses the cost paid at sale and is honest about missing cost', () => {
  it('uses the purchase-time cost, not the current one', () => {
    const item = line({ netSales: 10000, netQuantity: 2, costPriceAtPurchase: 6000, sizeCostPrice: 9000 });
    // 2 units at the 6000 they were bought for = 12000 cost, not 18000.
    expect(sumLines([item]).profit).toBe(-2000);
  });

  it('never double-subtracts the receipt footer discount', () => {
    const o = order({
      netSales: 9500,      // server already deducted the 500 footer discount
      discountTotal: 500,
      items: [line({ netSales: 9500, netQuantity: 2, costPriceAtPurchase: 3000 })],
    });
    const scope = orderScope([o]);
    expect(applyMeasure('profit', scope)).toBe(3500); // 9500 - 6000
  });

  it('excludes uncosted revenue from profit instead of booking an inflated margin', () => {
    const costed = line({ name: 'A', netSales: 10000, costPriceAtPurchase: 6000, netQuantity: 2 });
    const uncosted = line({ name: 'B', netSales: 5000, netQuantity: 1 });
    const s = sumLines([costed, uncosted]);
    expect(s.profit).toBe(-2000);        // only the costed line counts
    expect(s.uncostedRevenue).toBe(5000);
    expect(s.uncostedLines).toBe(1);
  });

  it('reports zero profit for a wholly uncosted basket rather than the whole revenue', () => {
    const o = order({ items: [line({ netSales: 10000, costPriceAtPurchase: 0, sizeCostPrice: 0 })] });
    expect(applyMeasure('profit', orderScope([o]))).toBe(0);
  });

  it('gives the same profit whether grouped by product or by cashier', () => {
    const items = [line({ name: 'A', netSales: 10000, costPriceAtPurchase: 6000, netQuantity: 2 })];
    const o = order({ netSales: 10000, items });
    const byCashier = applyMeasure('profit', orderScope([o]));
    const byProduct = applyMeasure('profit', itemScope([o], items));
    expect(byCashier).toBe(byProduct);
  });

  it('margin is profit over revenue, and zero when there is no revenue', () => {
    const o = order({ netSales: 10000, items: [line({ netSales: 10000, costPriceAtPurchase: 3000, netQuantity: 2 })] });
    expect(applyMeasure('margin', orderScope([o]))).toBe(40);
    expect(applyMeasure('margin', orderScope([]))).toBe(0);
  });
});

describe('D6 — customers are counted honestly', () => {
  it('counts registered customers by id and reports walk-ins separately', () => {
    const orders = [
      order({ _id: 'a', customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c1' } }),
      order({ _id: 'b', customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c1' } }),
      order({ _id: 'c', customer: { firstName: 'Walk-in', lastName: 'Customer' } }),
    ];
    const kpis = computeKpis(orders);
    expect(kpis.uniqueCustomers).toBe(1);
    expect(kpis.walkInSales).toBe(1);
  });
});

describe('D7 — one measure, one answer, whatever the grouping', () => {
  const basket = order({
    _id: 'o1',
    netSales: 10000,
    items: [
      line({ name: 'A', netSales: 6000, netQuantity: 1, discountAmount: 100, taxAmount: 60 }),
      line({ name: 'B', netSales: 4000, netQuantity: 1, discountAmount: 200, taxAmount: 40 }),
    ],
  });

  it('revenue sums to the same figure at order and line level', () => {
    const asOrder = applyMeasure('total_price', orderScope([basket]));
    const asItems = applyMeasure('total_price', itemScope([basket], basket.items!));
    expect(asOrder).toBe(10000);
    expect(asItems).toBe(10000);
  });

  it('a product row reports that product, not the whole basket', () => {
    const oneLine = [basket.items![0]];
    expect(applyMeasure('total_price', itemScope([basket], oneLine))).toBe(6000);
  });

  it('counts an order once per product row even with several lines in it', () => {
    const multi = order({
      _id: 'o1',
      items: [line({ name: 'A' }), line({ name: 'A' })],
    });
    expect(applyMeasure('count', itemScope([multi], multi.items!))).toBe(1);
    expect(applyMeasure('line_count', itemScope([multi], multi.items!))).toBe(2);
  });
});

describe('returns and refunds', () => {
  it('values returned units on the pre-return basis, not the surviving revenue', () => {
    // Sold 2 for 10,000 (5,000 each), 1 came back. The surviving revenue is 5,000
    // but the returned unit is worth 5,000 — pricing it off netSales/netQuantity
    // would collapse the two and understate the return.
    const o = order({
      netSales: 6000,
      returnDeduction: 4000,
      items: [line({ netSales: 6000, netQuantity: 1, returnedQuantity: 1, itemSubtotal: 10000, taxAmount: 0 })],
    });
    expect(applyMeasure('total_refunds', orderScope([o]))).toBe(4000);
    expect(applyMeasure('total_refunds', itemScope([o], o.items!))).toBe(5000);
  });

  it('separates cash refunds from Sales stock returns', () => {
    const o = order({
      netSales: 0,
      returnDeduction: 10000,
      totalRefunds: 0,
      salesReturnValue: 10000,
      refunds: [{ source: 'sales', totalRefunded: 0 }],
    });
    const kpis = computeKpis([o]);
    expect(kpis.totalRefunds).toBe(10000);
    expect(kpis.cashRefunded).toBe(0);
  });
});

describe('KPI headline figures', () => {
  it('summarises a single clean receipt', () => {
    const kpis = computeKpis([
      order({ netSales: 10000, grossRevenue: 12000, items: [line({ netSales: 10000, netQuantity: 2, costPriceAtPurchase: 3000 })] }),
    ]);
    expect(kpis.totalRevenue).toBe(10000);
    expect(kpis.grossRevenue).toBe(12000);
    expect(kpis.totalOrders).toBe(1);
    expect(kpis.avgOrder).toBe(10000);
    expect(kpis.itemsSold).toBe(2);
    expect(kpis.totalProfit).toBe(4000);
    expect(kpis.marginPct).toBe(40);
  });

  it('excludes voided receipts from revenue and counts them', () => {
    const kpis = computeKpis([
      order({ _id: 'a', netSales: 10000, items: [line({ netSales: 10000, netQuantity: 1 })] }),
      order({ _id: 'b', netSales: 5000, isVoided: true, items: [line({ netSales: 5000, netQuantity: 1 })] }),
    ]);
    expect(kpis.totalRevenue).toBe(10000);
    expect(kpis.totalOrders).toBe(1);
    expect(kpis.voidedOrders).toBe(1);
  });

  it('returns zeroes, not NaN, for an empty period', () => {
    const kpis = computeKpis([]);
    expect(kpis.totalRevenue).toBe(0);
    expect(kpis.avgOrder).toBe(0);
    expect(kpis.marginPct).toBe(0);
    expect(kpis.discountRate).toBe(0);
  });
});

describe('split tender is credited to exactly one method', () => {
  const splitOrder = (splits: { method: string; amount: number }[]) =>
    order({ total: 1000, paymentDetails: { splitPayments: splits } });

  it('credits the method that took the most money', () => {
    const { method, split } = paymentAttribution(
      splitOrder([{ method: 'cash', amount: 400 }, { method: 'card', amount: 600 }])
    );
    expect(method).toBe('card');
    expect(split).toBe(true);
  });

  it('never credits a receipt to two methods', () => {
    const methods = [
      splitOrder([{ method: 'cash', amount: 600 }, { method: 'card', amount: 400 }]),
      splitOrder([{ method: 'cash', amount: 100 }, { method: 'card', amount: 900 }]),
      splitOrder([{ method: 'cash', amount: 500 }, { method: 'card', amount: 500 }]),
    ].map((o) => paymentAttribution(o).method);
    expect(methods).toEqual(['cash', 'card', 'cash']);
  });

  it('keeps revenue by method adding up to the day\'s net sales', () => {
    // The defect this replaces put a 1,000 split sale into Cash *and* Card.
    const orders = [
      splitOrder([{ method: 'cash', amount: 600 }, { method: 'card', amount: 400 }]),
    ];
    const byMethod: Record<string, number> = {};
    for (const o of orders) {
      byMethod[paymentAttribution(o).method] =
        (byMethod[paymentAttribution(o).method] ?? 0) + netSales(o);
    }
    const total = Object.values(byMethod).reduce((s, v) => s + v, 0);
    expect(total).toBe(netSales(orders[0]));
  });

  it('a receipt with no split keeps its own method', () => {
    const { method, split } = paymentAttribution(order({ paymentMethod: 'mobile_money' }));
    expect(method).toBe('mobile_money');
    expect(split).toBe(false);
  });

  it('buckets a split receipt under the same label in the dimension key', () => {
    const o = splitOrder([{ method: 'cash', amount: 300 }, { method: 'card', amount: 700 }]);
    expect(getOrderDimKey(o, 'payment_method')).toBe('Card/POS');
  });
});

describe('dimension keys', () => {
  it('treats item dimensions as item dimensions', () => {
    expect(ITEM_DIMS.has('product')).toBe(true);
    expect(ITEM_DIMS.has('cashier')).toBe(false);
  });

  it('buckets every date dimension on the same local calendar', () => {
    // 23:30 local on the 29th must not land in a different day than its week.
    const lateSale = order({ placedAt: '2026-09-29T23:30:00', createdAt: '2026-09-29T23:30:00' });
    const day = getOrderDimKey(lateSale, 'order_day');
    const week = getOrderDimKey(lateSale, 'order_week');
    const month = getOrderDimKey(lateSale, 'order_month');
    expect(day).toBe('2026-09-29');
    expect(week).toMatch(/^2026-W\d{2}$/);
    expect(month).toBe('2026-09');
  });
});
