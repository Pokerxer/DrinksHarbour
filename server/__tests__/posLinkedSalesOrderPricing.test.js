// server/__tests__/posLinkedSalesOrderPricing.test.js
//
// What a customer is charged when a cashier loads a quotation at the till.
//
// `createPOSOrder` recomputes every price server-side and accepts the cart's
// price only within 1% of its own figure. That band is right for an ordinary
// sale — it is the tamper guard on a number that arrived from the client — and
// it is not widened here.
//
// It is wrong for a quotation. A quotation is a negotiated, ISSUED offer: a 10%
// deal price, a manually overridden line, a price from a pricelist that has
// since changed — each is more than 1% from today's POS price by construction.
// So the server silently discarded the agreed price, charged today's, and (via
// reconcile) marked the quote paid in full for its own total. Nobody was told.
//
// The fix is not a bigger tolerance. It is that a linked Sales Order's prices
// are re-read FROM THE DATABASE by the server, so the agreed price never has to
// arrive from the client and never has to be trusted.
//
// These drive the real handler and assert on the document handed to
// `Order.create` — the payload that reaches persistence and therefore the
// receipt. The failure mode is a plausible wrong NUMBER, not an error: every
// unit involved behaves correctly, and a test that only checks "an order was
// created" passes with the bug in place.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Tenant = require('../models/Tenant');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const POSSession = require('../models/POSSession');
const SalesOrder = require('../models/SalesOrder');
const InventoryMovement = require('../models/InventoryMovement');
const pricelistService = require('../services/pricelist.service');
const pos = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const OTHER_TENANT = oid();
const SP = oid();
const SIZE = oid();
const SODA = oid(); // a second product, never on any quotation
const SO_ID = oid();

/**
 * Minimal stand-in for a chained Mongoose query. Thenable as well as chainable,
 * because the handler awaits some of these queries without calling `.lean()` —
 * and a chain object that is merely truthy would be mistaken for a document.
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

/**
 * baseSellingPrice 5,000 with a 25% tenant markup — `computePOSPricing` turns
 * that into today's POS price, which every test below reads rather than
 * hard-codes, so a change to the pricing pipeline can't quietly invalidate them.
 */
function subProduct(id = SP, name = 'Hennessy VS') {
  return {
    _id: id,
    sku: 'SKU-1',
    product: { _id: oid(), name, images: [], platformMarkup: 10 },
    baseSellingPrice: 5000,
    costPrice: 3000,
    isOnSale: false,
    flashSale: {},
    bundleDeals: [],
    defaultSize: null,
  };
}

const TENANT_DOC = { _id: TENANT, revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12,
  posSettings: { allowOverselling: true } };

/** Today's server-computed POS price for the fixture above. */
const POS_PRICE = pos.computePOSPricing(subProduct(), null, TENANT_DOC).sellingPrice;

/**
 * A quotation line, using the field names `models/SalesOrder.js` actually
 * declares — `size`, not `sizeId`.
 */
function quoteLine(over = {}) {
  return {
    _id: oid(), lineType: 'product', subproduct: SP, size: null,
    name: 'Hennessy VS', quantity: 10, unitPrice: 4000,
    discount: 0, discountType: 'fixed', promoDiscount: 0, taxRate: 0,
    fulfilledQty: 0,
    ...over,
  };
}

function quotation(over = {}) {
  return {
    _id: SO_ID, tenant: TENANT, docType: 'quotation', soNumber: 'Q-0001',
    items: [quoteLine()],
    ...over,
  };
}

/**
 * Install every read `createPOSOrder` makes, and capture what it hands to
 * `Order.create`. No warehouse and overselling on, so stock deduction is the
 * short Size/SubProduct path and these tests stay about the money.
 */
function stub(t, { salesOrder = null } = {}) {
  const captured = {};

  t.mock.method(Tenant, 'findById', () => chainable(null));
  t.mock.method(Warehouse, 'findOne', () => chainable(null));
  t.mock.method(POSSession, 'findOne', () => chainable(null));
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(InventoryMovement, 'updateMany', () => Promise.resolve());
  t.mock.method(InventoryMovement, 'create', async () => ({}));
  t.mock.method(pricelistService, 'resolveShopPricelist', async () => ({ resolved: null, allowed: [] }));

  t.mock.method(SubProduct, 'findById', (id) =>
    chainable(String(id) === String(SODA) ? subProduct(SODA, 'Coca-Cola') : subProduct()));
  t.mock.method(SubProduct, 'findOneAndUpdate', async () => ({ _id: SP, availableStock: 90 }));
  t.mock.method(Size, 'findById', () => chainable({ _id: SIZE, sellingPrice: 5200, costPrice: 3100 }));
  t.mock.method(Size, 'findOneAndUpdate', async () => ({ _id: SIZE, stock: 90, lowStockThreshold: 6 }));
  t.mock.method(Size, 'findByIdAndUpdate', async () => ({}));

  // The linked quotation, tenant-scoped exactly as the handler must scope it.
  t.mock.method(SalesOrder, 'findOne', (filter) => {
    if (!salesOrder) return chainable(null);
    const wantedTenant = String(filter?.tenant ?? '');
    const wantedId = String(filter?._id ?? '');
    const match = wantedId === String(salesOrder._id) && wantedTenant === String(salesOrder.tenant);
    return chainable(match ? salesOrder : null);
  });

  t.mock.method(Order, 'create', async (doc) => {
    captured.doc = doc;
    return { ...doc, _id: oid() };
  });

  return captured;
}

/** Run the real handler; hand back the document `Order.create` received. */
async function sell(t, body, opts = {}) {
  const captured = stub(t, opts);
  const res = {};
  res.status = (code) => { res.code = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };

  await pos.createPOSOrder(
    {
      tenant: TENANT_DOC,
      posUser: { _id: oid() },
      posPermissions: [],
      body: { paymentMethod: 'cash', amountTendered: 999999, ...body },
    },
    res,
    (err) => { throw err; }
  );

  assert.ok(captured.doc, `no order was created — handler replied ${JSON.stringify(res.body)}`);
  return captured.doc;
}

const lineFor = (doc, subproductId = SP) =>
  doc.items.find((i) => String(i.subproduct) === String(subproductId));

// ─────────────────────────────────────────────────────────────────────────────

test('the quoted price is what the customer is charged, not today\'s POS price', async (t) => {
  // ₦4,000 agreed against a ₦6,250-ish POS price — far outside the 1% band, by
  // construction, which is what a negotiated deal price looks like.
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), quantity: 3, clientPrice: 4000, price: 4000 }],
  }, { salesOrder: quotation() });

  assert.notEqual(
    lineFor(doc).priceAtPurchase, POS_PRICE,
    `the customer was charged today's price ₦${POS_PRICE} instead of the ₦4,000 they were quoted`
  );
  assert.equal(lineFor(doc).priceAtPurchase, 4000);
});

test('the quoted price is read from the database, never taken from the cart', async (t) => {
  // The cart claims ₦10 a bottle. The order is linked to a quotation that says
  // ₦4,000. A client-supplied price must not become authoritative just because
  // an SO id was sent alongside it.
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), quantity: 3, clientPrice: 10, price: 10 }],
  }, { salesOrder: quotation() });

  assert.equal(lineFor(doc).priceAtPurchase, 4000);
});

test('the quotation\'s agreed discount and promotion reach the till', async (t) => {
  // ₦2,000 off the whole line plus a ₦500 promotion on 10 × ₦4,000 →
  // (40,000 − 2,000 − 500) / 10 = ₦3,750 a bottle.
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), quantity: 4, clientPrice: 3750, price: 3750 }],
  }, {
    salesOrder: quotation({
      items: [quoteLine({ discount: 2000, discountType: 'fixed', promoDiscount: 500 })],
    }),
  });

  assert.equal(lineFor(doc).priceAtPurchase, 3750);
});

test('a sized quotation line is matched on `size`, the field the schema declares', async (t) => {
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), sizeId: String(SIZE), quantity: 2, clientPrice: 4000, price: 4000 }],
  }, { salesOrder: quotation({ items: [quoteLine({ size: SIZE, unitPrice: 4000 })] }) });

  assert.equal(lineFor(doc).priceAtPurchase, 4000);
});

test('a product the cashier added on top of the quote is priced normally', async (t) => {
  // The quote covers the Hennessy. The Coke is an ordinary sale and keeps the
  // ordinary guard: a cart price 40% adrift is still rejected.
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [
      { subProductId: String(SP), quantity: 1, clientPrice: 4000, price: 4000 },
      { subProductId: String(SODA), quantity: 1, clientPrice: 1, price: 1 },
    ],
  }, { salesOrder: quotation() });

  assert.equal(lineFor(doc).priceAtPurchase, 4000);
  assert.equal(
    lineFor(doc, SODA).priceAtPurchase, POS_PRICE,
    'an unquoted line must still go through the 1% tamper guard'
  );
});

test('an ordinary sale keeps the 1% tamper guard', async (t) => {
  const doc = await sell(t, {
    items: [{ subProductId: String(SP), quantity: 1, clientPrice: 10, price: 10 }],
  });

  assert.equal(
    lineFor(doc).priceAtPurchase, POS_PRICE,
    'widening the band for quotations must not widen it for everything else'
  );
});

test('a rounding-level difference on an ordinary sale is still honoured', async (t) => {
  const near = POS_PRICE - 1;
  const doc = await sell(t, {
    items: [{ subProductId: String(SP), quantity: 1, clientPrice: near, price: near }],
  });

  assert.equal(lineFor(doc).priceAtPurchase, near);
});

test('a quotation belonging to another tenant sets no prices at all', async (t) => {
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), quantity: 1, clientPrice: 4000, price: 4000 }],
  }, { salesOrder: quotation({ tenant: OTHER_TENANT }) });

  assert.equal(
    lineFor(doc).priceAtPurchase, POS_PRICE,
    'another tenant\'s quotation must not be able to set a price in this tenant\'s till'
  );
});

test('two sizes of one product on the same quote are not guessed at', async (t) => {
  // Ambiguity falls through to ordinary pricing rather than picking a line.
  // A cart line that lost its size (the pre-fix load bug) must not silently
  // acquire the cheaper of the two.
  const doc = await sell(t, {
    linkedSalesOrderId: String(SO_ID),
    items: [{ subProductId: String(SP), quantity: 1, clientPrice: 4000, price: 4000 }],
  }, {
    salesOrder: quotation({
      items: [
        quoteLine({ size: SIZE, unitPrice: 4000 }),
        quoteLine({ size: oid(), unitPrice: 9000 }),
      ],
    }),
  });

  assert.equal(lineFor(doc).priceAtPurchase, POS_PRICE);
});
