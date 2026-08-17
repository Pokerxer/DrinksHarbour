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
// tested as mutation of an injected plain-object "quotation", since the
// conversion is now in place and no second document is created.

const oid = () => new mongoose.Types.ObjectId();

test('convertQuotationToOrder converts the document in place, keeping its number', async (t) => {
  const tenantId = oid();
  const quoteId = oid();

  // If conversion creates a second document, this blows up with a clear message
  // rather than silently passing on a copy.
  t.mock.method(SalesOrder, 'create', async () => {
    throw new Error('SalesOrder.create must not be called — conversion is in place');
  });

  const saveFn = t.mock.fn(async function save() { return this; });

  const quotation = {
    _id: quoteId,
    tenant: tenantId,
    soNumber: 'SO00002',
    docType: 'quotation',
    currency: 'NGN',
    customer: oid(),
    items: [
      {
        product: oid(), subproduct: oid(), size: oid(),
        lineType: 'product',
        description: 'chilled, deliver Friday',
        discountType: 'percentage',
        quantity: 10, unitPrice: 500, discount: 0, lineTotal: 5000,
        fulfilledQty: 3, postedQty: 2, returnedQty: 1,
      },
    ],
    subtotal: 5000,
    discountTotal: 0,
    total: 5000,
    paymentTerms: 'net_7',
    notes: 'some notes',
    terms: 'some terms',
    quoteStatus: 'sent',
    save: saveFn,
  };

  const order = await svc.convertQuotationToOrder(quotation);

  // It is the same document.
  assert.strictEqual(order, quotation);
  assert.strictEqual(String(order._id), String(quoteId));
  assert.strictEqual(order.soNumber, 'SO00002');

  // It is now an order, and it remembers it was a quotation.
  assert.strictEqual(order.docType, 'order');
  assert.strictEqual(order.orderStatus, 'draft');
  assert.strictEqual(order.quoteStatus, 'converted');

  // Fulfilment counters start clean.
  assert.strictEqual(order.items[0].fulfilledQty, 0);
  assert.strictEqual(order.items[0].postedQty, 0);
  assert.strictEqual(order.items[0].returnedQty, 0);

  // The three fields the old hand-written copy silently dropped.
  assert.strictEqual(order.items[0].lineType, 'product');
  assert.strictEqual(order.items[0].description, 'chilled, deliver Friday');
  assert.strictEqual(order.items[0].discountType, 'percentage');

  // Pricing is untouched — nothing is re-priced at conversion.
  assert.strictEqual(order.items[0].unitPrice, 500);
  assert.strictEqual(order.items[0].lineTotal, 5000);
  assert.strictEqual(order.total, 5000);

  // The payment clock starts now.
  assert.ok(order.dueDate instanceof Date);

  // No second document, so nothing to link.
  assert.strictEqual(order.convertedTo, undefined);
  assert.strictEqual(order.convertedFrom, undefined);

  assert.strictEqual(saveFn.mock.calls.length, 1);
});
