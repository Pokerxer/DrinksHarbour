// server/__tests__/posQuotationFulfillNumber.test.js
//
// The path this work exists for: a cashier sells against quotation SO00002 at
// the till. reconcileSalesOrderFromPOS converts the quotation on the way
// through, so before this change the fulfilled order came back numbered
// something else entirely and the customer's quote number named nothing live.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SalesOrder = require('../models/SalesOrder');
const salesLog = require('../services/salesActivity.service');
const posCtrl = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

// The controller logs an activity and swallows the failure, so leaving this
// unstubbed does not fail the test — it just spends 10s waiting for Mongoose to
// give up buffering. Stub it so the suite stays fast.
function stubActivityLog(t) {
  t.mock.method(salesLog, 'logActivity', async () => {});
}

test('fulfilling a quotation from the POS keeps its number', async (t) => {
  stubActivityLog(t);
  const tenantId = oid();
  const quoteId = oid();
  const subproductId = oid();
  const sizeId = oid();
  const lineId = oid();

  const quotation = {
    _id: quoteId,
    tenant: tenantId,
    soNumber: 'SO00002',
    docType: 'quotation',
    quoteStatus: 'accepted',
    total: 5000,
    amountPaid: 0,
    items: [{
      _id: lineId, lineType: 'product',
      subproduct: subproductId, size: sizeId,
      quantity: 10, unitPrice: 500, lineTotal: 5000,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  t.mock.method(SalesOrder, 'findOne', async () => quotation);

  let payload;
  const req = {
    params: { id: String(quoteId) },
    tenant: { _id: tenantId },
    posUser: { _id: oid() },
    body: {
      paymentMethod: 'cash',
      ref: 'RCP-20260817-0004',
      items: [{ subProductId: String(subproductId), sizeId: String(sizeId), quantity: 10 }],
    },
  };
  const res = { json(body) { payload = body; return this; }, status() { return this; } };

  await posCtrl.reconcileSalesOrderFromPOS(req, res, (err) => { throw err; });

  const order = payload.data;
  assert.strictEqual(order.soNumber, 'SO00002');
  assert.strictEqual(String(order._id), String(quoteId));
  assert.strictEqual(order.docType, 'order');
  assert.strictEqual(order.quoteStatus, 'converted');
  assert.strictEqual(order.orderStatus, 'fulfilled');
  assert.strictEqual(order.items[0].fulfilledQty, 10);
});

test('the POS reconcile records the terminal warehouse and the tender on the fulfilment', async (t) => {
  stubActivityLog(t);
  const tenantId = oid();
  const soId = oid();
  const subproductId = oid();
  const sizeId = oid();
  const warehouseId = oid();

  const order = {
    _id: soId, tenant: tenantId, soNumber: 'SO00006',
    docType: 'order', orderStatus: 'confirmed',
    total: 5000, amountPaid: 0,
    warehouseId: null,
    items: [{
      _id: oid(), lineType: 'product',
      subproduct: subproductId, size: sizeId,
      quantity: 10, unitPrice: 500, lineTotal: 5000,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  t.mock.method(SalesOrder, 'findOne', async () => order);

  const cashierId = oid();
  const req = {
    params: { id: String(soId) },
    tenant: { _id: tenantId },
    posUser: { _id: cashierId },
    body: {
      paymentMethod: 'cash',
      ref: 'RCP-20260817-0005',
      warehouseId: String(warehouseId),
      items: [{ subProductId: String(subproductId), sizeId: String(sizeId), quantity: 4 }],
    },
  };
  const res = { json() { return this; }, status() { return this; } };

  await posCtrl.reconcileSalesOrderFromPOS(req, res, (err) => { throw err; });

  const entry = order.fulfillments[0];
  assert.strictEqual(String(entry.warehouseId), String(warehouseId));
  assert.strictEqual(entry.paymentMethod, 'cash');
  assert.strictEqual(String(entry.by), String(cashierId));
  assert.strictEqual(entry.ref, 'RCP-20260817-0005');
});

test('with no warehouse from the till, the order\'s own warehouse is recorded', async (t) => {
  stubActivityLog(t);
  const tenantId = oid();
  const soId = oid();
  const subproductId = oid();
  const orderWarehouse = oid();

  const order = {
    _id: soId, tenant: tenantId, soNumber: 'SO00007',
    docType: 'order', orderStatus: 'confirmed',
    total: 5000, amountPaid: 0,
    warehouseId: orderWarehouse,
    items: [{
      _id: oid(), lineType: 'product', subproduct: subproductId,
      quantity: 10, unitPrice: 500, lineTotal: 5000,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  t.mock.method(SalesOrder, 'findOne', async () => order);

  const req = {
    params: { id: String(soId) },
    tenant: { _id: tenantId },
    posUser: { _id: oid() },
    body: {
      paymentMethod: 'card', ref: 'RCP-6',
      items: [{ subProductId: String(subproductId), quantity: 1 }],
    },
  };
  const res = { json() { return this; }, status() { return this; } };

  await posCtrl.reconcileSalesOrderFromPOS(req, res, (err) => { throw err; });

  assert.strictEqual(
    String(order.fulfillments[0].warehouseId),
    String(orderWarehouse)
  );
});
