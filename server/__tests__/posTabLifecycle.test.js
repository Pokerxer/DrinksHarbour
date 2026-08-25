// server/__tests__/posTabLifecycle.test.js
//
// Venue tabs: opening a table's tab and editing it while parked.
//
// An open tab IS a hold — the same status:'hold' order a cashier parks from
// the cart — bound to a POSTable through holdMetadata.tableId and claimed
// atomically onto the table row (status:'occupied' + currentTabId). Because
// two terminals can reach for the same free table, the claim is the part that
// must be airtight: whoever loses the race must not leave an orphaned hold
// pretending to sit at the table.
//
// updateTab is the other half: a tab's lines change as the party orders more.
// It must rewrite the parked cart in place — same _id, same createdAt, same
// table binding — because the table row points at the order's _id; giving the
// edit a new identity would orphan every table pointing at the old one.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const POSSession = require('../models/POSSession');
const POSTable = require('../models/POSTable');
const pos = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const STAFF = oid();
const TABLE = oid();
const TAB_ID = oid();
const OTHER_TAB = oid();
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

function res() {
  const r = {};
  r.status = (code) => { r.code = code; return r; };
  r.json = (payload) => { r.body = payload; return r; };
  return r;
}

/** A request from a till whose tenant runs venue mode. */
function venueReq(body, extra = {}) {
  return {
    tenant: { _id: TENANT, posSettings: { isBarRestaurant: true } },
    posUser: { _id: STAFF },
    body,
    params: {},
    ...extra,
  };
}

function availableTable() {
  return { _id: TABLE, tenant: TENANT, name: 'Bar 1', status: 'available', currentTabId: null };
}

function occupiedTable() {
  return { _id: TABLE, tenant: TENANT, name: 'Bar 1', status: 'occupied', currentTabId: OTHER_TAB };
}

/** One cart line exactly as `pos-cart.tsx` sends it. */
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

/** Standard persistence mocks for any code path that ends in Order.create. */
function mockHoldPersistence(t) {
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(POSSession, 'findOne', () => chainable(null));
  return t.mock.method(Order, 'create', async (doc) => ({
    ...doc,
    _id: TAB_ID,
    createdAt: new Date(),
  }));
}

// ─── Open tab ────────────────────────────────────────────────────────────────

test('opening a tab creates a hold bound to the table and claims the table atomically', async (t) => {
  let captured = null;
  let claimFilter = null;
  let claimUpdate = null;

  const createMock = mockHoldPersistence(t);
  t.mock.method(Order, 'create', async (doc) => {
    captured = doc;
    return { ...doc, _id: TAB_ID, createdAt: new Date() };
  });
  t.mock.method(POSTable, 'findOne', () => chainable(availableTable()));
  t.mock.method(POSTable, 'findOneAndUpdate', (filter, update) => {
    claimFilter = filter;
    claimUpdate = update;
    return Promise.resolve({ ...availableTable(), status: 'occupied', currentTabId: TAB_ID });
  });

  const r = res();
  await pos.openTabAtTable(
    venueReq({ tableId: String(TABLE), guests: 4 }),
    r,
    (err) => { throw err; }
  );

  assert.ok(captured, 'no hold was created');
  assert.equal(String(captured.holdMetadata.tableId), String(TABLE));
  assert.equal(captured.holdMetadata.guests, 4);
  assert.ok(captured.holdMetadata.openedAt, 'the floor map needs an explicit open time');

  // The claim must be conditional on the table still being available — that
  // condition is what makes two racing terminals resolve to one winner.
  assert.equal(claimFilter._id, String(TABLE));
  assert.equal(String(claimFilter.tenant), String(TENANT));
  assert.equal(claimFilter.status, 'available');
  assert.equal(claimUpdate.$set.status, 'occupied');
  assert.equal(String(claimUpdate.$set.currentTabId), String(TAB_ID));

  assert.equal(r.code, 201);
  assert.equal(r.body.success, true);
  assert.equal(String(r.body.data.tab._id), String(TAB_ID));
  assert.equal(r.body.data.table.status, 'occupied');
});

test('opening a tab on an occupied table refuses before creating a second hold', async (t) => {
  const createMock = mockHoldPersistence(t);
  t.mock.method(POSTable, 'findOne', () => chainable(occupiedTable()));

  const r = res();
  await pos.openTabAtTable(
    venueReq({ tableId: String(TABLE), guests: 2 }),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 409);
  assert.equal(r.body.message, 'table already has an open tab');
  assert.equal(createMock.mock.callCount(), 0, 'a losing open-tab must not park a throwaway hold');
});

test('losing the claim race recalls the just-created hold and reports the table gone', async (t) => {
  mockHoldPersistence(t);
  t.mock.method(POSTable, 'findOne', () => chainable(availableTable()));
  t.mock.method(POSTable, 'findOneAndUpdate', async () => null);

  let recallFilter = null;
  let recallSet = null;
  t.mock.method(Order, 'findOneAndUpdate', (filter, update) => {
    recallFilter = filter;
    recallSet = update.$set;
    return Promise.resolve({});
  });

  const r = res();
  await pos.openTabAtTable(
    venueReq({ tableId: String(TABLE) }),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 409);
  assert.equal(r.body.message, 'table no longer available');
  assert.equal(String(recallFilter._id), String(TAB_ID), 'the orphaned hold itself must be recalled');
  assert.equal(recallSet.status, 'recalled');
  assert.equal(recallSet.paymentStatus, 'cancelled');
});

// ─── Update tab ──────────────────────────────────────────────────────────────

test('updateTab replaces the parked cart in place, keeping the tab identity', async (t) => {
  const openedAt = new Date('2026-08-01T10:00:00Z');
  const doc = {
    _id: TAB_ID,
    createdAt: openedAt,
    status: 'hold',
    note: '',
    items: [{
      product: PRODUCT, subproduct: SUBPRODUCT, size: SIZE,
      quantity: 2, priceAtPurchase: 0, itemSubtotal: 0, discountAmount: 0,
    }],
    holdMetadata: {
      tableId: String(TABLE),
      guests: 4,
      openedAt: '2026-08-01T10:00:00.000Z',
      customer: { firstName: 'Ada', lastName: 'Obi' },
      discountType: 'percent',
      discountValue: 0,
      appliedRewards: [],
      cartItems: [cartLine()],
    },
    saved: false,
    async save() { this.saved = true; return this; },
  };

  t.mock.method(Order, 'findOne', () => chainable(doc));

  const r = res();
  await pos.updateTab(
    venueReq(
      {
        items: [cartLine({ name: 'Jameson', price: 9000, quantity: 1 })],
        customer: { firstName: 'Bola', lastName: 'Ade' },
        note: 'one for the table',
        discountType: 'amount',
        discountValue: 500,
        appliedRewards: [{ rewardId: String(oid()) }],
      },
      { params: { id: String(TAB_ID) } }
    ),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.body.success, true);
  assert.equal(doc.saved, true, 'the edit must persist through save()');

  // Identity untouched — the table row still points here.
  assert.equal(String(doc._id), String(TAB_ID));
  assert.equal(doc.createdAt.getTime(), openedAt.getTime());
  assert.equal(doc.status, 'hold');
  assert.equal(String(doc.holdMetadata.tableId), String(TABLE));
  assert.equal(doc.holdMetadata.guests, 4);

  // Lines replaced, still revenue-free like any held line.
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].quantity, 1);
  assert.equal(doc.items[0].priceAtPurchase, 0);
  assert.equal(doc.items[0].itemSubtotal, 0);
  assert.equal(doc.holdMetadata.cartItems[0].name, 'Jameson');
  assert.equal(doc.holdMetadata.cartItems[0].price, 9000);

  assert.deepEqual(doc.holdMetadata.customer, { firstName: 'Bola', lastName: 'Ade' });
  assert.equal(doc.note, 'one for the table');
  assert.equal(doc.holdMetadata.discountType, 'amount');
  assert.equal(doc.holdMetadata.discountValue, 500);
  assert.equal(doc.holdMetadata.appliedRewards.length, 1);
});

test('updateTab on an order that is not on hold finds nothing', async (t) => {
  t.mock.method(Order, 'findOne', () => chainable(null));

  const r = res();
  await pos.updateTab(
    venueReq({ items: [cartLine()] }, { params: { id: String(TAB_ID) } }),
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 404);
});

// ─── Hold passthrough ────────────────────────────────────────────────────────

test('holding a cart records its table binding in holdMetadata', async (t) => {
  let captured = null;
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(POSSession, 'findOne', () => chainable(null));
  t.mock.method(Order, 'create', async (doc) => {
    captured = doc;
    return { ...doc, _id: TAB_ID, createdAt: new Date() };
  });

  const r = res();
  await pos.holdPOSOrder(
    {
      tenant: { _id: TENANT },
      posUser: { _id: STAFF },
      body: {
        items: [cartLine()],
        tableId: String(TABLE),
        guests: 3,
      },
    },
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 201);
  assert.equal(String(captured.holdMetadata.tableId), String(TABLE));
  assert.equal(captured.holdMetadata.guests, 3);
  assert.ok(captured.holdMetadata.openedAt);
});

test('holding a cart with a malformed tableId is rejected', async (t) => {
  const r = res();
  await pos.holdPOSOrder(
    {
      tenant: { _id: TENANT },
      posUser: { _id: STAFF },
      body: { items: [cartLine()], tableId: 'not-an-objectid' },
    },
    r,
    (err) => { throw err; }
  );

  assert.equal(r.code, 400);
});

// ─── Venue gate ──────────────────────────────────────────────────────────────

test('both endpoints refuse to run when venue mode is off', async (t) => {
  // No DB mocks on purpose: the gate must fire before anything is touched.
  const plainReq = {
    tenant: { _id: TENANT },
    posUser: { _id: STAFF },
    body: {},
    params: {},
  };

  const r1 = res();
  await pos.openTabAtTable(plainReq, r1, (err) => { throw err; });
  assert.equal(r1.code, 400);
  assert.equal(r1.body.message, 'venue mode disabled');

  const r2 = res();
  await pos.updateTab(plainReq, r2, (err) => { throw err; });
  assert.equal(r2.code, 400);
  assert.equal(r2.body.message, 'venue mode disabled');
});
