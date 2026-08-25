// server/__tests__/orderTenantScoping.test.js
//
// The Order schema's root-level `tenant` field.
//
// Every POS handler that scopes an order to a tenant does it one of two ways:
// `{ 'items.tenant': id }` — which reads the per-line tenant on the item
// sub-schema — or `{ tenant: id }` at the root. Both appear throughout
// pos.controller.js, and they read as interchangeable.
//
// They were not. `orderSchema` declared `tenant` only inside the ITEM
// sub-schema; the root had no such path. Mongoose is strict by default, so
// `Order.create({ tenant: tenantId, ... })` dropped the field silently and
// every root-level `{ tenant }` query matched nothing — `getHeldPOSOrders`
// and `recallPOSOrder` among them, which is why a parked sale could be
// written and then never found again.
//
// The failure mode is a plausible EMPTY RESULT, not an error: nothing throws,
// the handler replies `{ success: true, data: { orders: [] } }`, and the
// cashier is told there are no held orders. A test that mocks `Order.findOne`
// cannot see it — the drop happens in the schema, so the assertion has to go
// through the real model.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');

const oid = () => new mongoose.Types.ObjectId();

/** A minimal valid order, as holdPOSOrder / createPOSOrder build one. */
function orderDoc(tenantId, over = {}) {
  return {
    orderNumber: 'TEST-001',
    tenant: tenantId,
    source: 'pos',
    status: 'hold',
    totalAmount: 0,
    subtotal: 0,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    items: [
      {
        product: oid(),
        tenant: tenantId,
        quantity: 1,
        priceAtPurchase: 4000,
        itemSubtotal: 4000,
      },
    ],
    ...over,
  };
}

test('the Order schema declares a root-level tenant path', () => {
  // Without this path, strict mode drops `tenant` on write and every
  // `Order.find({ tenant })` in pos.controller.js silently matches nothing.
  assert.ok(
    Object.keys(Order.schema.paths).includes('tenant'),
    'orderSchema has no root-level `tenant` — root-scoped queries cannot match'
  );
});

test('a tenant written at the root survives the strict schema', () => {
  const tenantId = oid();
  const persisted = new Order(orderDoc(tenantId)).toObject();

  assert.ok(
    persisted.tenant,
    'the root tenant was dropped — the order is written unowned and is then unfindable'
  );
  assert.equal(String(persisted.tenant), String(tenantId));
});

test('the per-item tenant still survives alongside it', () => {
  // `items.tenant` drives revenue split and the multi-tenant order checks.
  // Adding the root field must not disturb it.
  const tenantId = oid();
  const persisted = new Order(orderDoc(tenantId)).toObject();

  assert.equal(String(persisted.items[0].tenant), String(tenantId));
});

test('tip and rounding survive the strict schema', () => {
  // Gratuity and the cash-rounding delta are real money on the receipt; if
  // either is undeclared they vanish the same silent way `tenant` did.
  const tenantId = oid();
  const persisted = new Order(
    orderDoc(tenantId, { tipAmount: 500, roundingAmount: -3 })
  ).toObject();

  assert.equal(persisted.tipAmount, 500, 'the tip was dropped');
  assert.equal(persisted.roundingAmount, -3, 'the rounding delta was dropped');
});

test('tip and rounding default to zero when not supplied', () => {
  // Most sales carry neither. They must read as 0, not undefined, so the
  // receipt and the Z-report can sum them without guarding every access.
  const persisted = new Order(orderDoc(oid())).toObject();

  assert.equal(persisted.tipAmount, 0);
  assert.equal(persisted.roundingAmount, 0);
});
