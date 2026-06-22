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
    getUnitCost: async () => 0,
  };
  const revenue = { revenueModel: 'markup' };
  const paymentMethod = 'cash';
  // First fulfillment: 60
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 60 }], userId: 'u1', deps, revenue, paymentMethod });
  assert.strictEqual(so.items[0].fulfilledQty, 60);
  assert.strictEqual(so.items[0].postedQty, 60);
  assert.strictEqual(so.orderStatus, 'partially_fulfilled');
  assert.strictEqual(adjusted[0].quantity, 60);

  // Second fulfillment: 40 -> posts only 40, total stock decrement = 100
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 40 }], userId: 'u1', deps, revenue, paymentMethod });
  assert.strictEqual(so.items[0].fulfilledQty, 100);
  assert.strictEqual(so.items[0].postedQty, 100);
  assert.strictEqual(so.orderStatus, 'fulfilled');
  const totalShipped = adjusted.reduce((s, a) => s + a.quantity, 0);
  assert.strictEqual(totalShipped, 100);
});

test('fulfillOrder gates postedQty/Sales-row on per-line shipping success and rolls back failed lines', async () => {
  const salesRowsCreated = [];
  const so = {
    soNumber: 'SO-3', _id: 'so3', tenant: 't1',
    items: [
      { _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, unitPrice: 500, discount: 0, fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
      { _id: 'L2', product: 'p2', subproduct: 'sp2', size: 'sz2', quantity: 50, unitPrice: 300, discount: 0, fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
    ],
    fulfillments: [],
    relatedSales: [],
    save: async function () { return this; },
  };
  const SalesModel = { create: async (row) => { salesRowsCreated.push(row); return row; } };
  const deps = {
    // L1 (sp1) succeeds; L2 (sp2) throws — simulating insufficient stock / missing batch / DB error.
    adjustStock: async (a) => {
      if (a.subProduct === 'sp2') throw new Error('Insufficient stock');
      return { currentQuantity: 0 };
    },
    SalesModel,
    getUnitCost: async () => 0,
  };

  const result = await fulfillOrder({
    salesOrder: so, tenantId: 't1', warehouseId: 'wh1',
    fulfillLines: [{ lineId: 'L1', qty: 100 }, { lineId: 'L2', qty: 50 }],
    userId: 'u1', deps, revenue: { revenueModel: 'markup' }, paymentMethod: 'cash',
  });

  const L1 = so.items.find((it) => it._id === 'L1');
  const L2 = so.items.find((it) => it._id === 'L2');

  // L1 posted successfully: advanced fully, one Sales row.
  assert.strictEqual(L1.fulfilledQty, 100);
  assert.strictEqual(L1.postedQty, 100);

  // L2 failed to post: rolled back to its previous state — never advanced, never posted.
  assert.strictEqual(L2.fulfilledQty, 0);
  assert.strictEqual(L2.postedQty, 0);

  // Exactly one Sales row written (for L1); none for the failed L2.
  assert.strictEqual(salesRowsCreated.length, 1);
  assert.strictEqual(salesRowsCreated[0].subproduct, 'sp1');
  assert.strictEqual(result.salesRows.length, 1);

  // Failure surfaced.
  assert.strictEqual(result.posting.failCount, 1);
  assert.strictEqual(result.posting.successCount, 1);
  assert.ok(result.posting.failures.some((f) => f.lineId === 'L2'));
  assert.ok(result.posting.postedLineIds.includes('L1'));
  assert.ok(!result.posting.postedLineIds.includes('L2'));

  // Order status reflects only what actually shipped — must not jump to 'fulfilled'.
  assert.strictEqual(so.orderStatus, 'partially_fulfilled');

  // L2 stays outstanding: a future /fulfill call would retry it (delta still > 0).
  assert.strictEqual(Math.max(0, L2.quantity - L2.fulfilledQty - (L2.returnedQty || 0)), 50);
});
