// server/__tests__/salesOrder.e2e.test.js
//
// Task 9: end-to-end lifecycle test — quotation -> convert -> confirm ->
// fulfill 60 -> fulfill 40 -> return 20, asserting the ledger is consistent
// throughout.
//
// ADAPTATION NOTE: the original brief specified mongodb-memory-server, which
// is not a dependency anywhere in this repo (see salesOrder.quotation.test.js
// for the established precedent). Every test in this suite instead uses
// node:test's t.mock.method to stub Mongoose model methods and drives the
// REAL service functions directly — no live DB connection. This test follows
// that same convention at the integration level: it exercises the real
// createSalesOrderDoc -> convertQuotationToOrder -> capturePayment ->
// fulfillOrder (x2) -> returnOrder chain, with SalesOrder.create and the
// SO-number counter mocked, and recording stubs for adjustStock / Sales rows
// / wallet / loyalty.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');
const { capturePayment } = require('../services/salesPayment.service');
const { fulfillOrder, returnOrder } = require('../services/salesFulfill.service');

const oid = () => new mongoose.Types.ObjectId();

test('quotation -> convert -> confirm -> fulfill 60 -> fulfill 40 -> return 20: ledger consistent', async (t) => {
  const tenantId = oid();
  const userId = oid();
  const product = oid();
  const subproduct = oid();
  const size = oid();

  // SalesOrder.create is the only persistence boundary this test needs to
  // mock: it fabricates a real ObjectId for the doc and for each item (the
  // fulfillment helpers key lines by `_id`), plus a no-op save() and the
  // arrays the services push into (fulfillments/relatedSales).
  t.mock.method(SalesOrder, 'create', async (payload) => {
    const _id = oid();
    const items = (payload.items || []).map((it) => ({ ...it, _id: oid() }));
    const doc = {
      ...payload,
      _id,
      items,
      fulfillments: payload.fulfillments || [],
      relatedSales: payload.relatedSales || [],
      save: async function () { return this; },
    };
    return doc;
  });
  // generateSalesOrderNumber (utils/orderUtils.js) counts via
  // SalesOrder.countDocuments — stub that too so doc creation needs no DB.
  t.mock.method(SalesOrder, 'countDocuments', async () => 0);

  // ---- 1. Quotation ----------------------------------------------------
  const quote = await svc.createSalesOrderDoc({
    tenantId,
    body: {
      docType: 'quotation',
      items: [{ product, subproduct, size, quantity: 100, unitPrice: 500, discount: 0 }],
    },
  });
  assert.strictEqual(quote.total, 50000);
  assert.strictEqual(quote.quoteStatus, 'draft');

  // ---- 2. Convert quotation -> order ------------------------------------
  const order = await svc.convertQuotationToOrder(quote);
  assert.strictEqual(order.docType, 'order');
  assert.strictEqual(order.orderStatus, 'draft');
  assert.strictEqual(quote.quoteStatus, 'converted');
  assert.strictEqual(String(quote.convertedTo), String(order._id));

  // ---- 3. Confirm (capture payment in cash; no wallet/loyalty customer) --
  const pay = await capturePayment({
    salesOrder: order,
    tenantId,
    paymentMethod: 'cash',
    amountTendered: 50000,
    userId,
    posSettings: {},
    deps: {
      mutateWallet: async () => ({ ok: true, tx: { _id: oid() } }),
      mutateLoyalty: async () => ({ ok: true }),
    },
  });
  assert.strictEqual(pay.ok, true);
  order.orderStatus = 'confirmed';
  order.paymentStatus = 'paid';
  order.amountPaid = order.total;

  // ---- 4 + 5. Fulfill 60, then 40 — recording adjustStock + Sales rows ---
  // netShipped accumulates the NET stock movement across both fulfillments
  // and the later return: +qty for 'shipped' (out of stock), -qty for
  // 'received' (back into stock). This is the single ledger that must read
  // exactly 100 after the two fulfillments and exactly 80 after the return.
  const stockCalls = [];
  let netShipped = 0;
  const adjustStock = async (args) => {
    stockCalls.push(args);
    netShipped += args.type === 'shipped' ? args.quantity : -args.quantity;
    return { currentQuantity: 0 };
  };

  const salesRows = [];
  const SalesModel = {
    create: async (row) => {
      const saved = { _id: oid(), ...row };
      salesRows.push(saved);
      return saved;
    },
  };

  const lineId = String(order.items[0]._id);
  const warehouseId = oid();

  await fulfillOrder({
    salesOrder: order, tenantId, warehouseId,
    fulfillLines: [{ lineId, qty: 60 }],
    userId, deps: { adjustStock, SalesModel },
  });
  assert.strictEqual(order.orderStatus, 'partially_fulfilled');
  assert.strictEqual(order.items[0].fulfilledQty, 60);
  assert.strictEqual(order.items[0].postedQty, 60);

  await fulfillOrder({
    salesOrder: order, tenantId, warehouseId,
    fulfillLines: [{ lineId, qty: 40 }],
    userId, deps: { adjustStock, SalesModel },
  });
  assert.strictEqual(order.orderStatus, 'fulfilled');
  assert.strictEqual(order.items[0].fulfilledQty, 100);
  assert.strictEqual(order.items[0].postedQty, 100);

  // Core invariant: net shipped across BOTH fulfillments is exactly 100 —
  // never double-posted (e.g. never 160, which would happen if the second
  // fulfillment re-posted the already-shipped 60 instead of only its delta).
  assert.strictEqual(netShipped, 100);
  const totalShippedQty = stockCalls
    .filter((c) => c.type === 'shipped')
    .reduce((s, c) => s + c.quantity, 0);
  assert.strictEqual(totalShippedQty, 100);

  // Sales rows: two rows (60 + 40), summing to 100 units; linked on the order.
  assert.strictEqual(salesRows.length, 2);
  assert.strictEqual(salesRows.reduce((s, r) => s + r.quantity, 0), 100);
  assert.deepStrictEqual(salesRows.map((r) => r.quantity).sort((a, b) => a - b), [40, 60]);
  assert.strictEqual(order.relatedSales.length, 2);

  // ---- 6. Return 20 -> restock; net shipped becomes 80 ------------------
  await returnOrder({
    salesOrder: order, tenantId, warehouseId,
    returnLines: [{ lineId, qty: 20 }],
    userId,
    deps: { adjustStock, recordMovement: async () => {} },
  });

  assert.strictEqual(order.items[0].returnedQty, 20);
  // 100 shipped - 20 restocked ('received') = net 80 still out of the warehouse.
  assert.strictEqual(netShipped, 80);
});
