// server/__tests__/salesOrder.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');

const oid = () => new mongoose.Types.ObjectId();

test('SalesOrder defaults: quote/order statuses undefined, qty trackers zero', () => {
  const so = new SalesOrder({
    tenant: oid(), soNumber: 'SO-1', docType: 'order',
    items: [{ product: oid(), subproduct: oid(), size: oid(), quantity: 5, unitPrice: 1000, lineTotal: 5000 }],
    subtotal: 5000, total: 5000,
  });
  assert.strictEqual(so.items[0].fulfilledQty, 0);
  assert.strictEqual(so.items[0].postedQty, 0);
  assert.strictEqual(so.items[0].returnedQty, 0);
  assert.strictEqual(so.paymentStatus, 'unpaid');
  assert.strictEqual(so.currency, 'NGN');
});

test('SalesOrder requires tenant, soNumber, docType', () => {
  const so = new SalesOrder({});
  const err = so.validateSync();
  assert.ok(err.errors.tenant);
  assert.ok(err.errors.soNumber);
  assert.ok(err.errors.docType);
});

test('SalesOrder rejects an out-of-enum docType', () => {
  const so = new SalesOrder({ tenant: oid(), soNumber: 'SO-2', docType: 'invoice' });
  const err = so.validateSync();
  assert.ok(err.errors.docType);
});
