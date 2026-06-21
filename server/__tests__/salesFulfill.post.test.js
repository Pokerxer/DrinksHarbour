// server/__tests__/salesFulfill.post.test.js
const test = require('node:test');
const assert = require('node:assert');
const { postShippedStock } = require('../services/salesFulfill.helpers');
const { fulfillOrder } = require('../services/salesFulfill.service');

test('postShippedStock decrements each posting line once via adjustStock(shipped)', async () => {
  const calls = [];
  const adjustStock = async (args) => { calls.push(args); return { currentQuantity: 40 }; };
  const so = { soNumber: 'SO-1', _id: 'so1' };
  const postingLines = [
    { subproduct: 'sp1', size: 'sz1', product: 'p1', qty: 60 },
  ];
  const out = await postShippedStock({
    salesOrder: so, targetWarehouseId: 'wh1', postingLines, adjustStock,
    userId: 'u1', tenantId: 't1', logger: { error() {}, log() {} },
  });
  assert.strictEqual(out.successCount, 1);
  assert.strictEqual(calls[0].type, 'shipped');
  assert.strictEqual(calls[0].quantity, 60);
  assert.strictEqual(String(calls[0].warehouseId), 'wh1');
});

test('fulfillOrder posts only the unposted delta and advances postedQty/fulfilledQty', async () => {
  const adjusted = [];
  const so = {
    soNumber: 'SO-2', _id: 'so2', tenant: 't1',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, unitPrice: 500, discount: 0, fulfilledQty: 0, postedQty: 0, returnedQty: 0 }],
    fulfillments: [],
    save: async function () { return this; },
  };
  const SalesModel = { create: async (rows) => rows };
  const deps = {
    adjustStock: async (a) => { adjusted.push(a); return { currentQuantity: 0 }; },
    SalesModel,
  };
  // First fulfillment: 60
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 60 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].fulfilledQty, 60);
  assert.strictEqual(so.items[0].postedQty, 60);
  assert.strictEqual(so.orderStatus, 'partially_fulfilled');
  assert.strictEqual(adjusted[0].quantity, 60);

  // Second fulfillment: 40 -> posts only 40, total stock decrement = 100
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 40 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].fulfilledQty, 100);
  assert.strictEqual(so.items[0].postedQty, 100);
  assert.strictEqual(so.orderStatus, 'fulfilled');
  const totalShipped = adjusted.reduce((s, a) => s + a.quantity, 0);
  assert.strictEqual(totalShipped, 100);
});
