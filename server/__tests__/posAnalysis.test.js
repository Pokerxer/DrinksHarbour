const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalysisPayload } = require('../services/posAnalysis.service');
const { mapReportOrder } = require('../services/posReportOrder.service');

const mappedOrder = (over = {}) =>
  mapReportOrder({
    _id: 'o1',
    orderNumber: 'RCP-1',
    totalAmount: 1300,
    subtotal: 1000,
    taxAmount: 0,
    placedAt: '2026-09-29T10:00:00.000Z',
    createdAt: '2026-09-29T10:00:00.000Z',
    paymentMethod: 'cash',
    tipAmount: 200,
    items: [
      {
        _name: 'Jameson',
        quantity: 2,
        priceAtPurchase: 500,
        itemSubtotal: 1000,
        taxAmount: 0,
        discountAmount: 0,
        vendorPriceAtPurchase: 300,
        size: { costPrice: 450 },
        product: { name: 'Jameson', category: { name: 'Whiskey' }, brand: { name: 'Jameson' } },
        warehouse: { name: 'Main Store' },
      },
    ],
    refunds: [],
    lineNetTotals: [{ netSales: 1000, netQuantity: 2, returnedQuantity: 0 }],
    ...over,
  });

test('returns every matched receipt, not a truncated page', () => {
  const orders = Array.from({ length: 1500 }, (_, i) =>
    mappedOrder({ _id: `o${i}`, lineNetTotals: [{ netSales: 1000, netQuantity: 2 }] })
  );
  const { meta } = buildAnalysisPayload(orders);
  assert.equal(meta.included, 1500);
  assert.equal(meta.matched ?? meta.scanned, 1500);
  assert.equal(meta.truncated, false);
});

test('keeps the tender basis and the commercial basis separate', () => {
  const [{ order }] = buildAnalysisPayload([mappedOrder()]).orders;
  assert.equal(order.total, 1300);        // goods + tip
  assert.equal(order.grossRevenue, 1100); // goods only
  assert.equal(order.netSales, 1100);
  assert.equal(order.netCollections, 1300);
  assert.equal(order.tipAmount, 200);
});

test('a line carries the cost paid at sale and today\'s cost apart', () => {
  const [{ lines }] = buildAnalysisPayload([mappedOrder()]).orders;
  assert.equal(lines[0].k, 300); // paid at sale
  assert.equal(lines[0].x, 450); // current Size cost
});

test('a line with no cost snapshot reports zero, not a guess', () => {
  const o = mappedOrder({ items: [{ _name: 'A', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500 }] });
  const [{ lines }] = buildAnalysisPayload([o]).orders;
  assert.equal(lines[0].k, 0);
  assert.equal(lines[0].x, 0);
});

test('carries the tax actually charged, quotation-linked or not', () => {
  // A VAT-registered tenant is taxed at the till, so a report must show that
  // tax even though no quotation is attached to the receipt.
  const [{ order }] = buildAnalysisPayload([mappedOrder({ taxAmount: 100 })]).orders;
  assert.equal(order.taxAmount, 100);
  const [{ order: plain }] = buildAnalysisPayload([
    mappedOrder({ taxAmount: undefined, items: [{ _name: 'A', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500, taxAmount: 0 }] }),
  ]).orders;
  assert.equal(plain.taxAmount, undefined);
});

test('carries the customer identity needed to count customers honestly', () => {
  const [{ order }] = buildAnalysisPayload([
    mappedOrder({ paymentDetails: { customer: { firstName: 'Ada', lastName: 'Obi', customerId: 'c9' } } }),
  ]).orders;
  assert.equal(order.customer.customerId, 'c9');
});

test('carries split payments so a split sale is not counted twice', () => {
  const [{ order }] = buildAnalysisPayload([
    mappedOrder({ paymentDetails: { splitPayments: [{ method: 'cash', amount: 600 }, { method: 'card', amount: 400 }] } }),
  ]).orders;
  assert.equal(order.splitPayments.length, 2);
  assert.equal(order.splitPayments[0].amount, 600);
});

test('flags truncation instead of silently dropping receipts', () => {
  const orders = Array.from({ length: 10 }, (_, i) => mappedOrder({ _id: `o${i}` }));
  const { orders: out, meta } = buildAnalysisPayload(orders, { maxLines: 3 });
  assert.equal(meta.truncated, true);
  assert.equal(out.length, 3);
  assert.equal(meta.scanned, 10);
});

test('produces a small payload — this is what removes the need for page-size limits', () => {
  const o = mappedOrder();
  const bytes = JSON.stringify(buildAnalysisPayload([o]).orders).length;
  assert.ok(bytes < 1200, `compact row was ${bytes} bytes, expected well under 1.2kB`);
});

test('handles an empty period without throwing', () => {
  const { orders, meta } = buildAnalysisPayload([]);
  assert.deepEqual(orders, []);
  assert.equal(meta.included, 0);
  assert.equal(meta.truncated, false);
});
