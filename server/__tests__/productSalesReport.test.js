const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductSalesReport } = require('../services/product-sales-report');
const item = (extra = {}) => ({
  product: 'p',
  subproduct: 'sp',
  tenant: 'a',
  size: 's',
  quantity: 5,
  ...extra,
});
const receipt = (extra = {}) => ({
  _id: 'r',
  tenant: 'a',
  source: 'pos',
  status: 'delivered',
  paymentStatus: 'paid',
  paidAt: '2026-10-16T10:00:00Z',
  receiptNumber: 'POS-1',
  items: [item()],
  paymentDetails: {
    customer: { firstName: 'Ada', lastName: 'Obi', phone: 'secret' },
  },
  ...extra,
});
const sale = (extra = {}) => ({
  _id: 'so',
  tenant: 'a',
  docType: 'order',
  orderStatus: 'fulfilled',
  paymentStatus: 'paid',
  soNumber: 'SO-1',
  customerSnapshot: { name: 'Customer', email: 'secret' },
  items: [{ _id: 'line', ...item(), fulfilledQty: 5, returnedQty: 0 }],
  fulfillments: [
    {
      _id: 'f',
      status: 'posted',
      ref: 'POS-1',
      at: '2026-10-16T10:00:00Z',
      items: [{ lineId: 'line', qty: 5 }],
    },
  ],
  ...extra,
});
const report = (orders, sales = [], tenantId = null) =>
  buildProductSalesReport({
    productId: 'p',
    tenantId,
    orders,
    sales,
    tenants: [{ _id: 'a', name: 'Shop A' }],
    sizes: [{ _id: 's', subproduct: 'sp', tenant: 'a', displayName: '70cl' }],
  });
test('history counts linked POS/Sales once, names buyers and never exposes contact data', () => {
  const r = report([receipt({ linkedSalesOrder: 'so' })], [sale()]);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.totals, { gross: 5, returned: 0, net: 5, transactions: 1 });
  assert.equal(r.rows[0].buyer, 'Ada Obi');
  assert.equal(r.rows[0].size, '70cl');
  assert.doesNotMatch(JSON.stringify(r), /secret|phone|email/);
});
test('net sold reconciles overlapping POS and Sales returns, preserving original quantity', () => {
  const r = report(
    [
      receipt({
        linkedSalesOrder: 'so',
        refunds: [
          { items: [{ orderItemIndex: 0, quantity: 2, salesReturnedQuantity: 2 }] },
        ],
      }),
    ],
    [sale({ items: [{ _id: 'line', ...item(), fulfilledQty: 5, returnedQty: 2 }] })]
  );
  assert.deepEqual(r.totals, { gross: 5, returned: 2, net: 3, transactions: 1 });
});
test('includes only paid, fulfilled units and scopes individual basket lines to tenant and product', () => {
  const r = report(
    [
      receipt({
        items: [
          item(),
          item({ tenant: 'b', quantity: 100 }),
          item({ product: 'other', quantity: 100 }),
        ],
      }),
      receipt({ _id: 'unpaid', paymentStatus: 'pending' }),
      receipt({ _id: 'void', isVoided: true }),
      receipt({ _id: 'held', status: 'hold' }),
      receipt({ _id: 'web', source: 'web', status: 'processing' }),
    ],
    [],
    'a'
  );
  assert.equal(r.totals.net, 5);
});
test('partial Sales fulfillment uses actual dates and quantities, not ordered quantity', () => {
  const r = report(
    [],
    [
      sale({
        orderStatus: 'partially_fulfilled',
        items: [
          {
            _id: 'line',
            ...item({ quantity: 20 }),
            fulfilledQty: 3,
            returnedQty: 1,
          },
        ],
        fulfillments: [
          {
            _id: 'f',
            status: 'posted',
            at: '2026-10-15T10:00:00Z',
            items: [{ lineId: 'line', qty: 3 }],
          },
        ],
      }),
    ]
  );
  assert.equal(r.totals.net, 2);
  assert.equal(r.rows[0].gross, 3);
  assert.equal(r.rows[0].buyer, 'Customer');
  assert.equal(r.rows[0].soldAt, '2026-10-15T10:00:00.000Z');
});
test('undated fulfillment and unknown quantities mark history incomplete, never fabricate dates', () => {
  const r = report([], [sale({ fulfillments: [] })]);
  assert.equal(r.complete, false);
  assert.equal(r.rows.length, 0);
  const legacy = report([receipt({ paidAt: null, createdAt: null })]);
  assert.equal(legacy.rows[0].soldAt, null);
  assert.equal(legacy.complete, false);
});
test('web buyers are named from linked users; delivered date is explicit; newest first', () => {
  const r = report([
    receipt({
      _id: 'web',
      source: 'web',
      deliveredAt: '2026-10-17T12:00:00Z',
      user: { _id: 'u', firstName: 'Chika', lastName: 'Okoro', email: 'secret' },
      paymentDetails: {},
    }),
    receipt(),
  ]);
  assert.equal(r.rows[0].buyer, 'Chika Okoro');
  assert.equal(r.rows[0].soldAt, '2026-10-17T12:00:00.000Z');
  assert.equal(r.rows[0].dateBasis, 'Delivered');
});
test('receipt reference recovery avoids legacy double counting and unknown buyer is explicit', () => {
  const r = report([receipt({ paymentDetails: {} })], [sale()]);
  assert.equal(r.totals.net, 5);
  assert.equal(r.rows[0].buyer, 'Walk-in customer');
});
test('fully refunded delivered online purchases remain visible as returned sales', () => {
  const r = report([
    receipt({
      source: 'web',
      status: 'refunded',
      paymentStatus: 'refunded',
      deliveredAt: '2026-10-16T11:00:00Z',
      refunds: [{ items: [{ orderItemIndex: 0, quantity: 5 }] }],
    }),
  ]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.totals.gross, 5);
  assert.equal(r.totals.returned, 5);
  assert.equal(r.totals.net, 0);
});
test('missing item quantity or subproduct is unknown evidence rather than a definitive zero', () => {
  assert.equal(
    report([receipt({ items: [item({ quantity: undefined })] })]).complete,
    false
  );
  assert.equal(
    report([receipt({ items: [item({ subproduct: undefined })] })]).complete,
    false
  );
});
test('a monetary refund without item quantities cannot confirm the net sold count', () => {
  const r = report([receipt({ paymentStatus: 'refunded', refunds: [] })]);
  assert.equal(r.complete, false);
});
test('legacy fulfillment rows without IDs still have stable unique keys', () => {
  const r = report(
    [],
    [
      sale({
        fulfillments: [
          {
            status: 'posted',
            at: '2026-10-15',
            items: [{ lineId: 'line', qty: 2 }],
          },
          {
            status: 'posted',
            at: '2026-10-16',
            items: [{ lineId: 'line', qty: 3 }],
          },
        ],
      }),
    ]
  );
  assert.equal(new Set(r.rows.map((row) => row.key)).size, 2);
});
