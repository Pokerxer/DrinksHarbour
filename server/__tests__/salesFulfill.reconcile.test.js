// server/__tests__/salesFulfill.reconcile.test.js
const test = require('node:test');
const assert = require('node:assert');
const { reconcileFulfillment } = require('../services/salesFulfill.service');

function makeOrder(overrides = {}) {
  return {
    soNumber: 'SO-R', _id: 'soR', tenant: 't1',
    orderStatus: 'confirmed',
    items: [
      { _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 10, fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
      { _id: 'L2', product: 'p2', subproduct: 'sp2', size: 'sz2', quantity: 5, fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
    ],
    fulfillments: [],
    save: async function () { return this; },
    ...overrides,
  };
}

test('reconcileFulfillment marks a fully-sold order fulfilled without posting stock or Sales rows', async () => {
  const so = makeOrder();
  const { order, reconciled } = await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'L1', qty: 10 }, { lineId: 'L2', qty: 5 }],
    userId: 'u1',
  });

  assert.strictEqual(order.items[0].fulfilledQty, 10);
  assert.strictEqual(order.items[0].postedQty, 10);
  assert.strictEqual(order.items[1].fulfilledQty, 5);
  assert.strictEqual(order.items[1].postedQty, 5);
  assert.strictEqual(order.orderStatus, 'fulfilled');
  assert.strictEqual(reconciled, 2);

  // Audit entry recorded as a reconcile (not a stock-posting fulfillment).
  assert.strictEqual(order.fulfillments.length, 1);
  assert.strictEqual(order.fulfillments[0].status, 'reconciled');
  assert.ok(!order.fulfillments[0].warehouseId, 'reconcile entry carries no warehouse');
});

test('reconcileFulfillment leaves a partially-sold order partially_fulfilled', async () => {
  const so = makeOrder();
  await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'L1', qty: 4 }], // only 4 of 10 on L1, nothing on L2
    userId: 'u1',
  });

  assert.strictEqual(so.items[0].fulfilledQty, 4);
  assert.strictEqual(so.items[0].postedQty, 4);
  assert.strictEqual(so.items[1].fulfilledQty, 0);
  assert.strictEqual(so.orderStatus, 'partially_fulfilled');
});

test('reconcileFulfillment clamps to outstanding and keeps postedQty == fulfilledQty (no double-post on later fulfill)', async () => {
  const so = makeOrder();
  await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'L1', qty: 999 }], // over-sell attempt
    userId: 'u1',
  });

  assert.strictEqual(so.items[0].fulfilledQty, 10, 'clamped to ordered qty');
  // postedQty == fulfilledQty means buildPostingLines() delta is 0 for this line.
  assert.strictEqual(so.items[0].postedQty, so.items[0].fulfilledQty);
});

test('reconcileFulfillment with no matching lines is a no-op (no status change, no fulfillment entry)', async () => {
  const so = makeOrder({ orderStatus: 'confirmed' });
  const { reconciled } = await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'DOES_NOT_EXIST', qty: 3 }],
    userId: 'u1',
  });

  assert.strictEqual(reconciled, 0);
  assert.strictEqual(so.orderStatus, 'confirmed');
  assert.strictEqual(so.fulfillments.length, 0);
});
