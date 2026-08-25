// server/__tests__/posReportFields.test.js
//
// Whether the POS reports read fields that exist.
//
// pos.report.controller.js was written against an Order shape the schema does
// not have. It filtered orders by `posSession` (the field is `posSessionId`),
// treated a void as `status === 'voided'` ('voided' is not in the status enum
// — voids are flagged by `isVoided`), counted refunds by `isRefund` (no such
// field; refunds are an array), and summed `discountAmount` at order level
// (it is `discountTotal`). The per-item breakdown read `productId`, `name`,
// `finalPrice` and `unitPrice`, none of which exist on the item sub-schema.
//
// Every one of these failed the same silent way: an undefined field compares
// false or coerces to 0, so a report rendered with the right shape and the
// wrong numbers. `Order.find({ posSession: id })` matched nothing at all, so
// the honest description of the Z-report before this fix is that it reported
// a zeroed session no matter how much was sold in it.
//
// The schema tests below assert against the real model rather than a fixture,
// because a fixture built by hand would just repeat whatever mistake the
// controller made. The behavioural tests then run the real helpers over
// orders shaped the way createPOSOrder actually persists them.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const report = require('../controllers/pos.report.controller');

const orderPaths = new Set(Object.keys(Order.schema.paths));
const itemPaths = new Set(Object.keys(Order.schema.path('items').schema.paths));

// ── Order-level fields the reports filter and sum on ────────────────────────

test('the session link field the reports query exists', () => {
  assert.ok(
    orderPaths.has('posSessionId'),
    'posSessionId is the real field; the reports must not query `posSession`'
  );
  assert.ok(
    !orderPaths.has('posSession'),
    'if `posSession` now exists, the report queries need revisiting'
  );
});

test('a void is flagged by isVoided, not by a status value', () => {
  assert.ok(orderPaths.has('isVoided'), 'isVoided is how a void is recorded');
  assert.ok(
    !Order.schema.path('status').enumValues.includes('voided'),
    "'voided' is not a status — filtering on it silently matches no order"
  );
});

test('refunds are an array, not an isRefund boolean', () => {
  assert.ok(orderPaths.has('refunds'), 'refunds live in an array on the order');
  assert.ok(
    !orderPaths.has('isRefund'),
    'there is no isRefund flag — filtering on it yields an empty refund total'
  );
});

test('the order-level discount field is discountTotal', () => {
  assert.ok(orderPaths.has('discountTotal'));
  assert.ok(
    !orderPaths.has('discountAmount'),
    'discountAmount is an ITEM field; at order level it is discountTotal'
  );
});

// ── Item-level fields the product breakdown reads ───────────────────────────

test('the item price field is priceAtPurchase', () => {
  assert.ok(itemPaths.has('priceAtPurchase'));
  assert.ok(!itemPaths.has('finalPrice'), 'finalPrice does not exist on an item');
  assert.ok(!itemPaths.has('unitPrice'), 'unitPrice does not exist on an item');
});

test('the item product reference is `product`', () => {
  assert.ok(itemPaths.has('product'));
  assert.ok(!itemPaths.has('productId'), 'the ref is `product`, not `productId`');
});

// ── The shape a POS sale actually persists ──────────────────────────────────

test('a POS sale persists the fields the reports need to find it', () => {
  const tenantId = new mongoose.Types.ObjectId();
  const sessionId = new mongoose.Types.ObjectId();

  const persisted = new Order({
    orderNumber: 'RPT-1',
    tenant: tenantId,
    posSessionId: sessionId,
    source: 'pos',
    status: 'confirmed',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    subtotal: 5000,
    totalAmount: 5000,
    discountTotal: 250,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        tenant: tenantId,
        quantity: 2,
        priceAtPurchase: 2500,
        itemSubtotal: 4750,
        discountAmount: 250,
      },
    ],
  }).toObject();

  // The two keys the reports must filter on.
  assert.equal(String(persisted.posSessionId), String(sessionId));
  assert.equal(String(persisted.tenant), String(tenantId));

  // The figures they must sum.
  assert.equal(persisted.totalAmount, 5000);
  assert.equal(persisted.discountTotal, 250);
  assert.equal(persisted.items[0].priceAtPurchase, 2500);
  assert.equal(persisted.items[0].itemSubtotal, 4750);

  // And the ones they wrongly reached for, proving they read as undefined.
  assert.equal(persisted.posSession, undefined);
  assert.equal(persisted.isRefund, undefined);
  assert.equal(persisted.discountAmount, undefined);
  assert.equal(persisted.items[0].finalPrice, undefined);
  assert.equal(persisted.items[0].productId, undefined);
});

// ── The report logic, over orders shaped as the POS writes them ─────────────

/** An order shaped the way createPOSOrder persists one. */
function posOrder(over = {}) {
  return {
    status: 'confirmed',
    isVoided: false,
    refunds: [],
    paymentMethod: 'cash',
    totalAmount: 5000,
    discountTotal: 0,
    tipAmount: 0,
    roundingAmount: 0,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        quantity: 2,
        priceAtPurchase: 2500,
        itemSubtotal: 5000,
        discountAmount: 0,
      },
    ],
    ...over,
  };
}

test('a voided sale is excluded from revenue', () => {
  // The old check was `status !== 'voided'`, which excluded nothing, so a
  // voided sale was reported as takings that were never in the drawer.
  const { partitionOrders } = report.__test__;
  const { completed, voided } = partitionOrders([
    posOrder(),
    posOrder({ isVoided: true, status: 'cancelled' }),
    posOrder({ isVoided: true }),
  ]);

  assert.equal(completed.length, 1, 'only the live sale counts as revenue');
  assert.equal(voided.length, 1, 'the cancelled one is not double-counted');
});

test('a held cart is not revenue', () => {
  // A hold is a parked cart with totalAmount 0; it must not inflate orderCount.
  const { partitionOrders } = report.__test__;
  const { completed } = partitionOrders([
    posOrder(),
    posOrder({ status: 'hold', totalAmount: 0 }),
  ]);

  assert.equal(completed.length, 1);
});

test('the refund total comes from the refunds array', () => {
  // `isRefund` never existed, so every report showed zero refunds and a net
  // revenue equal to gross.
  const { partitionOrders, refundedTotal } = report.__test__;
  const { refunded } = partitionOrders([
    posOrder(),
    posOrder({ refunds: [{ totalRefunded: 1200 }, { totalRefunded: 300 }] }),
  ]);

  assert.equal(refunded.length, 1);
  assert.equal(
    refunded.reduce((s, o) => s + refundedTotal(o), 0),
    1500,
    'both refund records against the order must be summed'
  );
});

test('the product breakdown prices lines at priceAtPurchase', () => {
  // It read `finalPrice ?? unitPrice ?? 0` — neither exists — so every line
  // priced at zero and the top-products table was a list of zeroes.
  const { buildProductBreakdown } = report.__test__;
  const rows = buildProductBreakdown([posOrder()]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].gross, 5000, 'gross is priceAtPurchase x quantity');
  assert.equal(rows[0].net, 5000);
});

test('a line discount is not multiplied by quantity', () => {
  // discountAmount is already the LINE total. The old code multiplied it by
  // qty again, overstating discounts on every multi-unit line.
  const { buildProductBreakdown } = report.__test__;
  const rows = buildProductBreakdown([
    posOrder({
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          quantity: 4,
          priceAtPurchase: 1000,
          itemSubtotal: 3600,
          discountAmount: 400,
        },
      ],
    }),
  ]);

  assert.equal(rows[0].gross, 4000);
  assert.equal(rows[0].discounts, 400, 'the 400 is the whole line, not per unit');
  assert.equal(rows[0].net, 3600);
});

test('two lines of the same product aggregate under one key', () => {
  // Keying on the non-existent `productId` put every line under 'unknown',
  // collapsing the entire breakdown into a single meaningless row.
  const { buildProductBreakdown } = report.__test__;
  const productA = new mongoose.Types.ObjectId();
  const productB = new mongoose.Types.ObjectId();
  const line = (product, qty) => ({
    product,
    quantity: qty,
    priceAtPurchase: 1000,
    itemSubtotal: 1000 * qty,
    discountAmount: 0,
  });

  const rows = buildProductBreakdown([
    posOrder({ items: [line(productA, 2), line(productB, 1)] }),
    posOrder({ items: [line(productA, 3)] }),
  ]);

  assert.equal(rows.length, 2, 'two distinct products, not one "unknown" bucket');
  assert.equal(rows[0].qty, 5, 'the same product sold across two orders adds up');
});

test('a voided sale contributes nothing to the product breakdown', () => {
  const { buildProductBreakdown } = report.__test__;
  const rows = buildProductBreakdown([posOrder({ isVoided: true })]);
  assert.equal(rows.length, 0);
});
