'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const { updatePurchaseOrder, deletePurchaseOrder } = require('../controllers/purchaseOrder.controller');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

async function call(handler, orderId, tenant, body = {}) {
  let result;
  const res = { status: () => res, json: data => { result = data; } };
  await handler(
    { params: { id: orderId }, user: { tenant: String(tenant) }, body },
    res,
    error => { throw error; },
  );
  return result;
}

test('draft purchase actions enforce tenant, lifecycle, and receipt guards', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'purchase_draft_actions');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  const otherTenant = oid();
  let sequence = 0;
  const seed = async (fields = {}) => {
    const _id = oid();
    await PurchaseOrder.collection.insertOne({
      _id, tenant, createdBy: oid(), vendorName: 'Supplier', poNumber: `PO-${++sequence}`,
      status: 'draft', items: [], ...fields,
    });
    return _id;
  };

  await t.test('an unlocked draft can be edited and deleted by its tenant', async () => {
    const id = await seed();
    await assert.rejects(call(updatePurchaseOrder, id, otherTenant, { notes: 'foreign' }), { statusCode: 404 });
    await assert.rejects(call(deletePurchaseOrder, id, otherTenant), { statusCode: 404 });
    const result = await call(updatePurchaseOrder, id, tenant, { notes: 'Updated draft' });
    assert.equal(result.data.notes, 'Updated draft');
    assert.equal((await call(deletePurchaseOrder, id, tenant)).success, true);
    assert.equal(await PurchaseOrder.exists({ _id: id, tenant }), null);
  });

  await t.test('confirmed, fulfilled, locked and converted orders reject edits and deletion', async () => {
    for (const fields of [
      { status: 'confirmed' }, { status: 'partially_received' }, { status: 'received' },
      { status: 'validated' }, { status: 'cancelled' }, { status: 'done' },
      { isLocked: true }, { type: 'rfq', rfqStatus: 'converted' },
      { isPartiallyReceived: true }, { fullyReceivedDate: new Date() },
      { partialReceipts: [{ receiptNumber: 'R01' }] },
      { items: [{ subProductId: oid(), subProductName: 'Bottle', receivedQty: 2 }] },
      { items: [{ subProductId: oid(), subProductName: 'Bottle', postedQty: 2 }] },
      { items: [{ subProductId: oid(), subProductName: 'Bottle', returnedQty: 2 }] },
    ]) {
      const id = await seed(fields);
      await assert.rejects(call(updatePurchaseOrder, id, tenant, { notes: 'Not editable' }), { statusCode: 409 });
      await assert.rejects(call(deletePurchaseOrder, id, tenant), { statusCode: 409 });
      const stored = await PurchaseOrder.collection.findOne({ _id: id });
      assert.ok(stored);
      assert.equal(stored.notes, undefined);
    }
  });

  await t.test('an edit started before confirmation fails if confirmation wins the race', async t => {
    const id = await seed();
    const save = PurchaseOrder.prototype.save;
    t.mock.method(PurchaseOrder.prototype, 'save', async function (...args) {
      await PurchaseOrder.collection.updateOne({ _id: id }, { $set: { status: 'confirmed' } });
      return save.apply(this, args);
    });
    await assert.rejects(call(updatePurchaseOrder, id, tenant, { notes: 'Stale update' }), { statusCode: 409 });
    const stored = await PurchaseOrder.collection.findOne({ _id: id });
    assert.equal(stored.status, 'confirmed');
    assert.equal(stored.notes, undefined);
  });

  await t.test('deletion checks the order is still a draft in the delete operation', async t => {
    const id = await seed();
    const deleteOne = PurchaseOrder.findOneAndDelete;
    t.mock.method(PurchaseOrder, 'findOneAndDelete', async function (...args) {
      await PurchaseOrder.collection.updateOne({ _id: id }, { $set: { status: 'confirmed' } });
      return deleteOne.apply(this, args);
    });
    await assert.rejects(call(deletePurchaseOrder, id, tenant), { statusCode: 409 });
    assert.equal((await PurchaseOrder.collection.findOne({ _id: id })).status, 'confirmed');
  });
});
