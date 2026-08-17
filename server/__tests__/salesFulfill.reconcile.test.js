// server/__tests__/salesFulfill.reconcile.test.js
const test = require('node:test');
const assert = require('node:assert');
const { reconcileFulfillment } = require('../services/salesFulfill.service');

// L1: 10 × ₦1,000 = ₦10,000.  L2: 5 × ₦500 = ₦2,500.  total ₦12,500, untaxed,
// undiscounted — so every settled figure below is arithmetic a human can check.
function makeOrder(overrides = {}) {
  return {
    soNumber: 'SO-R', _id: 'soR', tenant: 't1',
    orderStatus: 'confirmed',
    paymentStatus: 'unpaid', amountPaid: 0, total: 12500,
    items: [
      { _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 10, unitPrice: 1000, fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
      { _id: 'L2', product: 'p2', subproduct: 'sp2', size: 'sz2', quantity: 5,  unitPrice: 500,  fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
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

// ─── What the till actually took ──────────────────────────────────────────────
//
// The reconcile used to end with `paymentStatus = 'paid'` and
// `amountPaid = order.total`, unconditionally. `reconcileFulfillment` clamped
// the LINES to what was really sold and set `partially_fulfilled`; the money
// fields did not follow. Sell 3 cases of a quoted 10 and the order read
// fulfilled-partially, paid-in-full, for all ten — and the receivable for the
// other seven simply stopped existing.
//
// These assert on the money, because the failure mode is a plausible wrong
// NUMBER on a saved order, not an error anyone would see.

test('selling 3 of a quoted 10 does not mark the order paid in full', async () => {
  const so = makeOrder();

  await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'L1', qty: 3 }],
    userId: 'u1',
  });

  assert.strictEqual(so.orderStatus, 'partially_fulfilled');
  assert.notStrictEqual(
    so.paymentStatus, 'paid',
    'a part-fulfilled order marked paid in full erases the receivable for everything not sold'
  );
  assert.strictEqual(so.paymentStatus, 'partial');
  assert.strictEqual(
    so.amountPaid, 3000,
    'amountPaid must be the 3 cases the till actually took (3 × ₦1,000), not the order total'
  );
});

test('a second POS sale settles the rest and completes the order', async () => {
  const so = makeOrder();

  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 3 }], userId: 'u1', ref: 'R-1' });
  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 7 }], userId: 'u1', ref: 'R-2' });

  assert.strictEqual(so.amountPaid, 10000, 'the two sales accumulate');
  assert.strictEqual(so.paymentStatus, 'partial', 'L2 is still outstanding');

  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'L2', qty: 5 }], userId: 'u1', ref: 'R-3' });

  assert.strictEqual(so.orderStatus, 'fulfilled');
  assert.strictEqual(so.paymentStatus, 'paid');
  assert.strictEqual(so.amountPaid, so.total);
});

test('a fully-sold order is paid at the order total, not at the sum of its lines', async () => {
  // Order-level money — a cart coupon, a pricelist cart discount, a shipping
  // fee — has no honest per-line share, so it is never prorated across a
  // partial sale. It lands whole, once, when the order completes.
  const so = makeOrder({ total: 13000, shippingFee: 500 });

  await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'L1', qty: 10 }, { lineId: 'L2', qty: 5 }],
    userId: 'u1',
  });

  assert.strictEqual(so.orderStatus, 'fulfilled');
  assert.strictEqual(so.amountPaid, 13000);
  assert.strictEqual(so.paymentStatus, 'paid');
});

test('the quoted line discount and promotion are what gets settled, not the list price', async () => {
  // A quotation is a negotiated offer: ₦2,000 off the whole line plus a ₦500
  // promotion. Selling 5 of the 10 settles half of the agreed money — half the
  // discount too — because a flat line discount has no other defensible split.
  const so = makeOrder({
    total: 9000,
    items: [
      { _id: 'L1', subproduct: 'sp1', quantity: 10, unitPrice: 1000,
        discount: 2000, discountType: 'fixed', promoDiscount: 500,
        fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
    ],
  });

  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 5 }], userId: 'u1' });

  // (10,000 − 2,000 − 500) × 5/10
  assert.strictEqual(so.amountPaid, 3750);
  assert.strictEqual(so.paymentStatus, 'partial');
});

test('line tax is settled along with the line', async () => {
  const so = makeOrder({
    total: 10750,
    items: [
      { _id: 'L1', subproduct: 'sp1', quantity: 10, unitPrice: 1000, taxRate: 7.5,
        fulfilledQty: 0, postedQty: 0, returnedQty: 0 },
    ],
  });

  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 4 }], userId: 'u1' });

  // (10,000 + 750) × 4/10
  assert.strictEqual(so.amountPaid, 4300);
});

test('replaying the same POS sale neither fulfils nor charges twice', async () => {
  // The offline queue replays an entry whose response was lost. Without a
  // per-sale reference the server cannot tell that from a genuine second sale
  // of the same product, and would fulfil 3 more units and take ₦3,000 more.
  const so = makeOrder();

  const first = await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 3 }], userId: 'u1', ref: 'RCP-0001',
  });
  const replay = await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'L1', qty: 3 }], userId: 'u1', ref: 'RCP-0001',
  });

  assert.strictEqual(first.reconciled, 1);
  assert.strictEqual(replay.reconciled, 0, 'the replay must be recognised, not re-applied');
  assert.strictEqual(so.items[0].fulfilledQty, 3, 'still 3 units sold, not 6');
  assert.strictEqual(so.amountPaid, 3000, 'still ₦3,000 taken, not ₦6,000');
  assert.strictEqual(so.fulfillments.length, 1, 'and only one audit entry');
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

// A POS fulfilment used to record nothing about itself: no warehouse (the
// schema field existed and was never set), and the tender went to the ORDER,
// where the next sale overwrote it. Sell 3 for cash today and 7 by transfer
// tomorrow and the order claimed it was all transfer.

test('reconcileFulfillment records the warehouse and the tender on the entry', async () => {
  const warehouseId = 'wh-main';
  const so = {
    soNumber: 'SO00002', _id: 'so2', tenant: 't1',
    total: 5000, amountPaid: 0,
    items: [{
      _id: 'l1', lineType: 'product', quantity: 10, unitPrice: 500,
      lineTotal: 5000, fulfilledQty: 0, postedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  await reconcileFulfillment({
    salesOrder: so,
    fulfillLines: [{ lineId: 'l1', qty: 4 }],
    userId: 'u1', ref: 'RCP-1',
    warehouseId, paymentMethod: 'cash',
  });

  assert.strictEqual(so.fulfillments.length, 1);
  assert.strictEqual(so.fulfillments[0].warehouseId, warehouseId);
  assert.strictEqual(so.fulfillments[0].paymentMethod, 'cash');
  assert.strictEqual(so.fulfillments[0].ref, 'RCP-1');
  assert.strictEqual(so.fulfillments[0].by, 'u1');
});

test('two tenders leave two entries, each with its own method', async () => {
  const so = {
    soNumber: 'SO00003', _id: 'so3', tenant: 't1',
    total: 5000, amountPaid: 0,
    items: [{
      _id: 'l1', lineType: 'product', quantity: 10, unitPrice: 500,
      lineTotal: 5000, fulfilledQty: 0, postedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'l1', qty: 3 }],
    ref: 'RCP-1', paymentMethod: 'cash',
  });
  await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'l1', qty: 7 }],
    ref: 'RCP-2', paymentMethod: 'transfer',
  });

  assert.deepStrictEqual(
    so.fulfillments.map((f) => f.paymentMethod),
    ['cash', 'transfer']
  );
});

test('a fulfilment with no warehouse or tender omits them rather than storing undefined', async () => {
  const so = {
    soNumber: 'SO00004', _id: 'so4', tenant: 't1',
    total: 5000, amountPaid: 0,
    items: [{
      _id: 'l1', lineType: 'product', quantity: 10, unitPrice: 500,
      lineTotal: 5000, fulfilledQty: 0, postedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  await reconcileFulfillment({ salesOrder: so, fulfillLines: [{ lineId: 'l1', qty: 1 }] });

  assert.ok(!('warehouseId' in so.fulfillments[0]));
  assert.ok(!('paymentMethod' in so.fulfillments[0]));
});

test('a replayed ref still short-circuits, and does not append a second entry', async () => {
  const so = {
    soNumber: 'SO00005', _id: 'so5', tenant: 't1',
    total: 5000, amountPaid: 0,
    items: [{
      _id: 'l1', lineType: 'product', quantity: 10, unitPrice: 500,
      lineTotal: 5000, fulfilledQty: 0, postedQty: 0,
      discount: 0, promoDiscount: 0, taxRate: 0, taxAmount: 0,
    }],
    fulfillments: [],
    save: async function () { return this; },
  };

  await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'l1', qty: 2 }],
    ref: 'RCP-9', warehouseId: 'wh-main', paymentMethod: 'cash',
  });
  const again = await reconcileFulfillment({
    salesOrder: so, fulfillLines: [{ lineId: 'l1', qty: 2 }],
    ref: 'RCP-9', warehouseId: 'wh-other', paymentMethod: 'card',
  });

  assert.strictEqual(again.duplicate, true);
  assert.strictEqual(so.fulfillments.length, 1);
  assert.strictEqual(so.fulfillments[0].warehouseId, 'wh-main');
});
