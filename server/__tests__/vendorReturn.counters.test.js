const test = require('node:test');
const assert = require('node:assert/strict');
test('supplier returns preserve outstanding quantity and cancellation restores receipt counters', async () => {
  const { syncPurchaseReturnCounters } = require('../services/vendorReturn.counters');
  const item = { _id: 'line', subProductId: 'sp', sizeId: 's', quantity: 10, receivedQty: 8, postedQty: 8, returnedQty: 0 };
  const po = { items: [item], save: async () => {} };
  const doc = { purchaseOrder: 'po', items: [{ subProductId: 'sp', sizeId: 's', quantity: 3 }], save: async () => {} };
  const deps = { PurchaseOrder: { findOne: async () => po } };
  await syncPurchaseReturnCounters(doc, 't', 'deduct', deps);
  assert.equal(item.receivedQty, 5); assert.equal(item.postedQty, 5); assert.equal(item.returnedQty, 3);
  assert.equal(item.quantity - item.receivedQty - item.returnedQty, 2);
  await syncPurchaseReturnCounters(doc, 't', 'deduct', deps);
  assert.equal(item.returnedQty, 3);
  await syncPurchaseReturnCounters(doc, 't', 'restore', deps);
  assert.equal(item.receivedQty, 8); assert.equal(item.postedQty, 8); assert.equal(item.returnedQty, 0);
});
