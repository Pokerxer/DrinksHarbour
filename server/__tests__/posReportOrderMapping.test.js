const test = require('node:test');
const assert = require('node:assert/strict');

// The report mapper is a pure projection of an already-fetched lean order, so the
// fields it guarantees are the contract every report screen depends on: the
// order list, the session report and the order-analysis page all read the same
// names. These tests pin that contract, because the version before this was
// hand-duplicated per endpoint and the copies silently diverged.
const { mapReportOrder, REPORT_ORDER_FIELDS } = require('../services/posReportOrder.service');

const order = (over = {}) => ({
  _id: 'o1',
  totalAmount: 1100,
  subtotal: 1000,
  taxAmount: 100,
  discountTotal: 0,
  paymentMethod: 'cash',
  status: 'confirmed',
  paymentStatus: 'paid',
  placedAt: '2026-09-29T10:00:00.000Z',
  createdAt: '2026-09-29T10:00:00.000Z',
  items: [{ _name: 'Jameson', quantity: 2, priceAtPurchase: 500, itemSubtotal: 1000, taxAmount: 100, discountAmount: 0 }],
  refunds: [],
  lineNetTotals: [{ netSales: 1100, netQuantity: 2, returnedQuantity: 0 }],
  ...over,
});

test('select list carries the fields the mapper reads', () => {
  for (const field of ['tipAmount', 'roundingAmount', 'items', 'refunds', 'posSessionId']) {
    assert.ok(REPORT_ORDER_FIELDS.includes(field), `REPORT_ORDER_FIELDS is missing ${field}`);
  }
});

test('gratuity and rounding are surfaced but kept out of commercial sales', () => {
  const o = order({ totalAmount: 1300, tipAmount: 200 });
  const r = mapReportOrder(o);
  assert.equal(r.tipAmount, 200);
  assert.equal(r.totalTips, 200);
  assert.equal(r.grossRevenue, 1100);
  assert.equal(r.netSales, 1100);
  assert.equal(r.netCollections, 1300);
});

test('line discount is reported alongside the order-level footer discount', () => {
  const o = order({
    discountTotal: 50,
    items: [
      { _name: 'A', quantity: 1, priceAtPurchase: 800, itemSubtotal: 700, discountAmount: 100, taxAmount: 0 },
      { _name: 'B', quantity: 1, priceAtPurchase: 300, itemSubtotal: 300, discountAmount: 25, taxAmount: 0 },
    ],
    lineNetTotals: [{ netSales: 700 }, { netSales: 300 }],
  });
  const r = mapReportOrder(o);
  assert.equal(r.discountTotal, 50);
  assert.equal(r.lineDiscountTotal, 125);
  assert.equal(r.items[0].discountAmount, 100);
  assert.equal(r.items[1].discountAmount, 25);
});

test('a line reports the cost paid at sale alongside today\'s cost', () => {
  const o = order({
    items: [{
      _name: 'A', quantity: 2, priceAtPurchase: 500, itemSubtotal: 1000, taxAmount: 0,
      vendorPriceAtPurchase: 300,          // what the tenant actually paid
      size: { costPrice: 450 },             // what the Size model says today
      subproduct: { costPrice: 460 },
    }],
    lineNetTotals: [{ netSales: 1000, netQuantity: 2 }],
  });
  const line = mapReportOrder(o).items[0];
  assert.equal(line.costPriceAtPurchase, 300);
  assert.equal(line.sizeCostPrice, 450);
});

test('legacy lines with no cost snapshot report zero rather than inventing one', () => {
  const o = order({
    items: [{ _name: 'A', quantity: 1, priceAtPurchase: 500, itemSubtotal: 500, taxAmount: 0 }],
    lineNetTotals: [{ netSales: 500, netQuantity: 1 }],
  });
  const line = mapReportOrder(o).items[0];
  assert.equal(line.costPriceAtPurchase, 0);
  assert.equal(line.sizeCostPrice, 0);
});

test('gross line value is pre-discount so gross can be shown beside net', () => {
  const o = order({
    items: [{ _name: 'A', quantity: 3, priceAtPurchase: 100, itemSubtotal: 250, discountAmount: 50, taxAmount: 0 }],
    lineNetTotals: [{ netSales: 250, netQuantity: 3 }],
  });
  const line = mapReportOrder(o).items[0];
  assert.equal(line.grossSubtotal, 300);   // 3 x 100
  assert.equal(line.itemSubtotal, 250);    // after the 50 discount
});

test('customer identity is carried through for unique-customer counting', () => {
  const o = order({
    paymentDetails: { customer: { firstName: 'Ada', lastName: 'Obi', phone: '0803', customerId: 'c9' } },
  });
  assert.equal(mapReportOrder(o).customer.customerId, 'c9');
});

test('an order with no customer maps to null rather than undefined', () => {
  assert.equal(mapReportOrder(order()).customer, null);
});

test('session is normalised whether the ref is populated or bare', () => {
  assert.deepEqual(
    mapReportOrder(order({ posSessionId: { _id: 's1', terminalType: 'bar', openedAt: 'x' } })).session,
    { _id: 's1', terminalType: 'bar', openedAt: 'x' }
  );
  assert.deepEqual(mapReportOrder(order({ posSessionId: 's2' })).session, { _id: 's2' });
  assert.equal(mapReportOrder(order()).session, null);
});

test('a voided receipt is zero commercially and in cash', () => {
  const r = mapReportOrder(order({ isVoided: true }));
  assert.equal(r.netSales, 0);
  assert.equal(r.netCollections, 0);
});

test('reports the tax actually charged, whether or not a quotation is linked', () => {
  // Tax is no longer only a quotation concept: a VAT-registered tenant is taxed
  // at the till too, so gating on `linkedSalesOrder` would hide that tax.
  assert.equal(mapReportOrder(order()).taxAmount, 100);
  assert.equal(mapReportOrder(order({ linkedSalesOrder: 'so1' })).taxAmount, 100);
});

test('reports no tax on a receipt that carried none', () => {
  const o = order();
  delete o.taxAmount;
  assert.equal(mapReportOrder(o).taxAmount, undefined);
});

test('split payments and tender detail are always present as arrays/numbers', () => {
  const r = mapReportOrder(order());
  assert.deepEqual(r.paymentDetails.splitPayments, []);
  assert.equal(r.paymentDetails.change, 0);
  assert.equal(r.paymentDetails.amount, 0);
});
