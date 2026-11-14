'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const VendorBill = require('../models/VendorBill');
const {
  getPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
} = require('../controllers/purchaseOrder.controller');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

test('RFQ cancellation respects tenant scope and receipt activity', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'purchase_cancellation');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  let sequence = 0;
  const seed = (fields = {}) => PurchaseOrder.create({
    tenant,
    createdBy: oid(),
    vendorName: 'Supplier',
    poNumber: `RFQ-${++sequence}`,
    type: 'rfq',
    status: 'confirmed',
    rfqStatus: 'sent',
    items: [{ subProductId: oid(), subProductName: 'Bottle', quantity: 5 }],
    ...fields,
  });

  async function call(handler, order, body, requestTenant = tenant) {
    let result;
    const res = { status: () => res, json: data => { result = data; } };
    await handler({ params: { id: order.id }, user: { tenant: String(requestTenant) }, body },
      res, error => { throw error; });
    return result.data;
  }

  const cancel = (order, requestTenant) =>
    call(updatePurchaseOrderStatus, order, { status: 'cancelled' }, requestTenant);
  const receive = order => call(receivePurchaseOrder, order, {
    receiptLines: [{ itemId: order.items[0].id, receivedQty: 2 }],
  });
  const read = order => PurchaseOrder.findOne({ _id: order.id, tenant });

  await t.test('cancellation closes both lifecycles and can be retried', async () => {
    const order = await seed();
    await assert.rejects(cancel(order, oid()), { statusCode: 404 });
    await cancel(order);
    const stored = await read(order);
    assert.equal(stored.status, 'cancelled');
    assert.equal(stored.rfqStatus, 'cancelled');
    await assert.rejects(receive(order), { statusCode: 400 });

    assert.equal((await cancel(order)).rfqStatus, 'cancelled');
    const second = await seed({ status: 'draft' });
    assert.equal((await cancel(second)).status, 'cancelled');
  });

  await t.test('purchase details expose only an active bill from the same tenant', async () => {
    const order = await seed({ status: 'received' });
    const billId = oid();
    await VendorBill.collection.insertMany([
      { _id: oid(), tenant: oid(), purchaseOrder: order._id, billNumber: 'FOREIGN', status: 'draft' },
      { _id: oid(), tenant, purchaseOrder: order._id, billNumber: 'CANCELLED', status: 'cancelled' },
      { _id: billId, tenant, purchaseOrder: order._id, billNumber: 'BIL-001', status: 'draft' },
    ]);
    const detail = await call(getPurchaseOrder, order, {});
    assert.equal(detail.activeVendorBill._id.toString(), billId.toString());
    assert.equal(detail.activeVendorBill.billNumber, 'BIL-001');
  });

  await t.test('a receipt or conversion blocks cancellation, even with a stale confirmed status', async () => {
    const order = await seed();
    await receive(order);
    await assert.rejects(cancel(order), { statusCode: 409 });
    await PurchaseOrder.updateOne({ _id: order.id, tenant }, { $set: { status: 'confirmed' } });
    await assert.rejects(cancel(order), { statusCode: 409 });

    const converted = await seed({ rfqStatus: 'converted' });
    await assert.rejects(cancel(converted), { statusCode: 409 });
  });

  await t.test('a receipt recorded during cancellation wins the race', async t => {
    const order = await seed();
    const update = PurchaseOrder.findOneAndUpdate;
    t.mock.method(PurchaseOrder, 'findOneAndUpdate', async function (...args) {
      await receive(order);
      return update.apply(this, args);
    });
    await assert.rejects(cancel(order), { statusCode: 409 });
    const stored = await read(order);
    assert.equal(stored.status, 'partially_received');
    assert.equal(stored.items[0].receivedQty, 2);
  });

  await t.test('a receipt in flight cannot reopen a cancelled quotation', async t => {
    const order = await seed();
    const save = PurchaseOrder.prototype.save;
    t.mock.method(PurchaseOrder.prototype, 'save', async function (...args) {
      if (this.id === order.id) await cancel(order);
      return save.apply(this, args);
    });
    await assert.rejects(receive(order), { statusCode: 409 });
    const stored = await read(order);
    assert.equal(stored.status, 'cancelled');
    assert.equal(stored.items[0].receivedQty, 0);
    assert.equal(stored.partialReceipts.length, 0);
  });
});
