// server/__tests__/salesOrder.quotation.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');

// NOTE on test strategy: this repo's test suite (see salesOrder.api.test.js,
// salesOrder.guards.test.js, salesFulfill.helpers.test.js) mocks Mongoose
// model methods with node:test's t.mock rather than booting a real DB via
// mongodb-memory-server (that package is not a dependency anywhere in this
// repo). We follow the same convention here: convertQuotationToOrder is
// tested as orchestration over an injected plain-object "quotation" and a
// mocked SalesOrder.create.

const oid = () => new mongoose.Types.ObjectId();

test('convertQuotationToOrder copies lines, links both ways, marks quote converted', async (t) => {
  const tenantId = oid();
  const quoteId = oid();

  t.mock.method(SalesOrder, 'countDocuments', async () => 0);

  let createPayload;
  t.mock.method(SalesOrder, 'create', async (payload) => {
    createPayload = payload;
    return { _id: oid(), ...payload };
  });

  const saveFn = t.mock.fn(async function save() { return this; });

  const quotation = {
    _id: quoteId,
    tenant: tenantId,
    currency: 'NGN',
    customer: oid(),
    items: [
      {
        product: oid(), subproduct: oid(), size: oid(),
        quantity: 10, unitPrice: 500, discount: 0, lineTotal: 5000,
        fulfilledQty: 3, postedQty: 2, returnedQty: 1,
      },
    ],
    subtotal: 5000,
    discountTotal: 0,
    total: 5000,
    notes: 'some notes',
    terms: 'some terms',
    quoteStatus: 'sent',
    save: saveFn,
  };

  const order = await svc.convertQuotationToOrder(quotation);

  // Created order assertions
  assert.strictEqual(order.docType, 'order');
  assert.strictEqual(order.orderStatus, 'draft');
  assert.strictEqual(order.items[0].quantity, 10);
  assert.strictEqual(order.items[0].unitPrice, 500);
  assert.strictEqual(order.items[0].lineTotal, 5000);
  assert.strictEqual(order.items[0].fulfilledQty, 0);
  assert.strictEqual(order.items[0].postedQty, 0);
  assert.strictEqual(order.items[0].returnedQty, 0);
  assert.strictEqual(order.total, 5000);
  assert.strictEqual(String(order.convertedFrom), String(quotation._id));

  // SalesOrder.create was invoked with the expected payload shape
  assert.strictEqual(createPayload.docType, 'order');
  assert.strictEqual(createPayload.orderStatus, 'draft');
  assert.strictEqual(String(createPayload.convertedFrom), String(quoteId));

  // Quotation mutation assertions
  assert.strictEqual(quotation.quoteStatus, 'converted');
  assert.strictEqual(String(quotation.convertedTo), String(order._id));
  assert.strictEqual(saveFn.mock.calls.length, 1);
});
