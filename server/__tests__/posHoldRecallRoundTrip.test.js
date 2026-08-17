// server/__tests__/posHoldRecallRoundTrip.test.js
//
// What a cashier gets back when they hold a cart and recall it.
//
// Hold/recall is a round trip through persistence, and the money was falling
// out of it in the middle: `holdPOSOrder` read only the identity fields off
// each cart line and hard-coded `priceAtPurchase: 0`, `discountAmount: 0`, so
// `recallPOSOrder` could only ever hand back zeros. The client sends the real
// price — it is discarded at HOLD time, not lost at recall.
//
// Both halves carried a comment claiming the other one handled it (server:
// "client recomputes from grid"; client: "the grid re-prices them"). Neither
// does. Read either file alone and the bug is invisible, which is why it needs
// a test that spans both handlers rather than either one.
//
// The display fields fail a second, quieter way: `holdPOSOrder` wrote `_name`,
// `_variant` and `_sku` onto the order item, and `orderItemSchema` declares
// none of them. Mongoose is strict by default, so it drops them silently and
// every recalled line comes back called "Product". A test that stubs
// `Order.create` and never touches the schema cannot see that — so these tests
// push the captured document through the real `Order` model before recalling
// it, which is the only way the strip actually happens.
//
// Failure mode throughout is a plausible wrong NUMBER (₦0.00) rather than an
// error: nothing throws, the cart renders, the lines are simply free. A test
// that asserts "items came back" passes with the bug in place.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const POSSession = require('../models/POSSession');
const pos = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const HOLD_ID = oid();
const PRODUCT = oid();
const SUBPRODUCT = oid();
const SIZE = oid();

/**
 * Minimal stand-in for a chained Mongoose query. Thenable as well as chainable,
 * because these handlers await some queries without calling `.lean()` — and a
 * chain object that is merely truthy would be mistaken for a document.
 */
function chainable(doc) {
  const q = {
    select: () => q,
    populate: () => q,
    sort: () => q,
    lean: async () => doc,
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
  return q;
}

/** One cart line exactly as `pos-cart.tsx` sends it to /api/pos/orders/hold. */
function cartLine(over = {}) {
  return {
    subProductId: String(SUBPRODUCT),
    productId: String(PRODUCT),
    sizeId: String(SIZE),
    name: 'Hennessy VS',
    variant: '75cl',
    sku: 'SKU-1',
    price: 4000,
    quantity: 3,
    discount: 15,
    costPrice: 3000,
    ...over,
  };
}

function res() {
  const r = {};
  r.status = (code) => { r.code = code; return r; };
  r.json = (payload) => { r.body = payload; return r; };
  return r;
}

/**
 * Hold a cart and return the persisted order — the document `Order.create`
 * received, put through the real `Order` schema so anything the schema does not
 * declare is stripped here exactly as it would be in Mongo.
 */
async function hold(t, items) {
  let captured = null;

  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(POSSession, 'findOne', () => chainable(null));
  t.mock.method(Order, 'create', async (doc) => {
    captured = doc;
    return { ...doc, _id: HOLD_ID, createdAt: new Date() };
  });

  const r = res();
  await pos.holdPOSOrder(
    {
      tenant: { _id: TENANT },
      posUser: { _id: oid() },
      body: { items, customer: { firstName: 'Ada', lastName: 'Obi' }, note: 'back in 5' },
    },
    r,
    (err) => { throw err; }
  );

  assert.ok(captured, `nothing was held — handler replied ${JSON.stringify(r.body)}`);

  // The strict-schema pass. Without this the test would assert on a plain object
  // the database never sees, and every undeclared field would appear to survive.
  const persisted = new Order({ ...captured, _id: HOLD_ID }).toObject();
  persisted.createdAt = new Date();
  return persisted;
}

/** Recall a persisted hold and return the cart the cashier gets back. */
async function recall(t, persisted) {
  t.mock.method(Order, 'findOne', () => chainable(persisted));
  t.mock.method(Order, 'deleteOne', async () => ({ deletedCount: 1 }));

  const r = res();
  await pos.recallPOSOrder(
    { tenant: { _id: TENANT }, params: { id: String(HOLD_ID) } },
    r,
    (err) => { throw err; }
  );

  assert.ok(r.body?.data?.cart, `no cart came back — handler replied ${JSON.stringify(r.body)}`);
  return r.body.data.cart;
}

/** The full round trip a cashier performs: Hold, then Held Orders → Recall. */
async function roundTrip(t, items = [cartLine()]) {
  return recall(t, await hold(t, items));
}

// ─────────────────────────────────────────────────────────────────────────────

test('a held line comes back at the price it was held at', async (t) => {
  const cart = await roundTrip(t);

  assert.equal(cart.items.length, 1);
  assert.equal(
    cart.items[0].price, 4000,
    'the recalled line is free — the cashier quotes ₦0.00 for a ₦4,000 bottle'
  );
});

test('a held line keeps the discount the cashier negotiated', async (t) => {
  const cart = await roundTrip(t);

  assert.equal(
    cart.items[0].discount, 15,
    'the agreed 15% is gone — the customer silently loses the deal on recall'
  );
});

test('a held line keeps its name, variant and sku', async (t) => {
  // These are written as `_name`/`_variant`/`_sku`, which `orderItemSchema` does
  // not declare, so the strict schema drops them before they ever reach Mongo.
  const cart = await roundTrip(t);

  assert.equal(cart.items[0].name, 'Hennessy VS');
  assert.equal(cart.items[0].variant, '75cl');
  assert.equal(cart.items[0].sku, 'SKU-1');
});

test('a held line keeps its ids, quantity and cost', async (t) => {
  const cart = await roundTrip(t);
  const line = cart.items[0];

  assert.equal(String(line.subProductId), String(SUBPRODUCT));
  assert.equal(String(line.productId), String(PRODUCT));
  assert.equal(String(line.sizeId), String(SIZE));
  assert.equal(line.quantity, 3);
  assert.equal(line.costPrice, 3000, 'cost is needed for markup_on_cost bundle pricing');
});

test('a held combo comes back grouped', async (t) => {
  // comboRef is what keeps the three bottles of a combo rendering as one block
  // in the cart. Lose it and a recalled combo is loose lines the cashier has to
  // reassemble by eye — and the combo discount goes with it.
  const comboRef = { comboId: String(oid()), comboName: 'Party Pack', instanceId: 'abc123' };
  const cart = await roundTrip(t, [cartLine({ comboRef })]);

  assert.deepEqual(cart.items[0].comboRef, comboRef);
});

test('holding a cart books no revenue', async (t) => {
  // A hold is not a sale. `getAllPOSOrders` has no status filter, so a hold that
  // carried a total would land in POS history and the session report as money.
  const persisted = await hold(t, [cartLine()]);

  assert.equal(persisted.status, 'hold');
  assert.equal(persisted.subtotal, 0);
  assert.equal(persisted.totalAmount, 0);
  assert.equal(persisted.discountTotal, 0);
  for (const it of persisted.items) {
    assert.equal(it.itemSubtotal, 0, 'a held line must not count as a sold line');
  }
});

test('a hold written before this fix still recalls', async (t) => {
  // Holds already in the database have no cart snapshot. They must still open —
  // refusing to recall a parked sale is worse than recalling it imperfectly.
  const legacy = {
    _id: HOLD_ID,
    tenant: TENANT,
    status: 'hold',
    note: 'legacy',
    items: [{ product: PRODUCT, subproduct: SUBPRODUCT, size: SIZE, quantity: 2,
              priceAtPurchase: 0, itemSubtotal: 0, discountAmount: 0, tenant: TENANT }],
    holdMetadata: { customer: { firstName: 'Walk-in', lastName: 'Customer' }, discountValue: 0 },
  };

  const cart = await recall(t, legacy);

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 2);
  assert.equal(String(cart.items[0].subProductId), String(SUBPRODUCT));
});
