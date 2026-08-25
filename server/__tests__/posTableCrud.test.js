// server/__tests__/posTableCrud.test.js
//
// Back-office CRUD for POS floor tables. Every handler is gated by
// venueBlocked (the tenant must have posSettings.isBarRestaurant) and scoped
// by the tenant attached to the request — the tests below pin both gates plus
// the two rules that keep the floor map honest:
//
//   1. Status is never editable through CRUD. A table is occupied because an
//      open tab points at it (currentTabId), and only the open/settle flows
//      may move that pointer — a settings screen that could flip status by
//      hand would desync it from the orders that define it.
//   2. A table with a live tab cannot be deleted out from under its bill.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const POSTable = require('../models/POSTable');
const Order = require('../models/Order');
const pt = require('../controllers/posTable.controller');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const TABLE_ID = oid();
const TAB_ID = oid();

/**
 * Minimal stand-in for a chained Mongoose query. Thenable as well as chainable,
 * because the handlers await some queries bare and others through .lean().
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

/** An admin-JWT request the way the route chain delivers it. */
function req(over = {}) {
  return {
    tenant: { _id: TENANT, posSettings: { isBarRestaurant: true } },
    body: {},
    params: {},
    user: { _id: oid(), role: 'admin', tenant: TENANT },
    ...over,
  };
}

const boom = (err) => { throw err; };

/** A duplicate-key rejection shaped like the one Mongo's unique index throws. */
function dupKeyError(name) {
  const err = new Error(`E11000 duplicate key error collection: postables`);
  err.code = 11000;
  err.keyValue = { tenant: String(TENANT), name };
  return err;
}

// ─── createTable ─────────────────────────────────────────────────────────────

test('createTable rejects a blank name with 400 and creates nothing', async (t) => {
  const create = t.mock.method(POSTable, 'create', async () => ({}));

  const r = res();
  await pt.createTable(req({ body: { name: '   ' } }), r, boom);

  assert.equal(r.code, 400);
  assert.equal(r.body.success, false);
  assert.equal(create.mock.callCount(), 0, 'no document may reach the DB without a name');
});

test('createTable scopes the new table to the tenant and trims the name', async (t) => {
  let captured = null;
  t.mock.method(POSTable, 'create', async (doc) => {
    captured = doc;
    return { _id: TABLE_ID, ...doc };
  });

  const r = res();
  await pt.createTable(req({ body: { name: '  Patio 12 ', seats: 6 } }), r, boom);

  assert.equal(r.code, 201);
  assert.equal(captured.tenant.toString(), TENANT.toString(), 'table must belong to the requesting tenant');
  assert.equal(captured.name, 'Patio 12');
  assert.equal(captured.seats, 6);
});

test('createTable maps a duplicate-key error to 409', async (t) => {
  t.mock.method(POSTable, 'create', async () => { throw dupKeyError('Bar 1'); });

  const r = res();
  await pt.createTable(req({ body: { name: 'Bar 1' } }), r, boom);

  assert.equal(r.code, 409);
  assert.equal(r.body.success, false);
  assert.match(r.body.message, /a table named "Bar 1" already exists/i);
});

// ─── updateTable ─────────────────────────────────────────────────────────────

test('updateTable refuses status changes even when the body asks nicely', async (t) => {
  const findOne = t.mock.method(POSTable, 'findOne', () => chainable(null));

  const r = res();
  await pt.updateTable(
    req({ params: { id: String(TABLE_ID) }, body: { status: 'available' } }),
    r,
    boom
  );

  assert.equal(r.code, 400);
  assert.match(r.body.message, /open\/settle/i);
  assert.equal(findOne.mock.callCount(), 0, 'rejected before any lookup');
});

test('updateTable refuses currentTabId edits too', async (t) => {
  t.mock.method(POSTable, 'findOne', () => chainable(null));

  const r = res();
  await pt.updateTable(
    req({ params: { id: String(TABLE_ID) }, body: { currentTabId: String(TAB_ID) } }),
    r,
    boom
  );

  assert.equal(r.code, 400);
});

test('updateTable maps a rename collision to 409', async (t) => {
  t.mock.method(POSTable, 'findOne', () => chainable({
    _id: TABLE_ID,
    tenant: TENANT,
    name: 'T1',
    save: async () => { throw dupKeyError('T2'); },
  }));

  const r = res();
  await pt.updateTable(
    req({ params: { id: String(TABLE_ID) }, body: { name: 'T2' } }),
    r,
    boom
  );

  assert.equal(r.code, 409);
  assert.match(r.body.message, /a table named "T2" already exists/i);
});

test('updateTable returns 404 for a table outside the tenant', async (t) => {
  t.mock.method(POSTable, 'findOne', () => chainable(null));

  const r = res();
  await pt.updateTable(
    req({ params: { id: String(TABLE_ID) }, body: { name: 'Renamed' } }),
    r,
    boom
  );

  assert.equal(r.code, 404);
});

// ─── deleteTable ─────────────────────────────────────────────────────────────

test('deleteTable blocks a table whose status is occupied', async (t) => {
  let deleted = false;
  t.mock.method(POSTable, 'findOne', () => chainable({
    _id: TABLE_ID,
    tenant: TENANT,
    name: 'T1',
    status: 'occupied',
    currentTabId: null,
    deleteOne: async () => { deleted = true; },
  }));

  const r = res();
  await pt.deleteTable(req({ params: { id: String(TABLE_ID) } }), r, boom);

  assert.equal(r.code, 400);
  assert.match(r.body.message, /open tab/i);
  assert.equal(deleted, false, 'an occupied table must survive a delete attempt');
});

test('deleteTable blocks a table holding a tab even if status drifted', async (t) => {
  let deleted = false;
  t.mock.method(POSTable, 'findOne', () => chainable({
    _id: TABLE_ID,
    tenant: TENANT,
    name: 'T1',
    status: 'available',
    currentTabId: TAB_ID,
    deleteOne: async () => { deleted = true; },
  }));

  const r = res();
  await pt.deleteTable(req({ params: { id: String(TABLE_ID) } }), r, boom);

  assert.equal(r.code, 400);
  assert.equal(deleted, false);
});

test('deleteTable removes a free table and reports success', async (t) => {
  let deleted = false;
  t.mock.method(POSTable, 'findOne', () => chainable({
    _id: TABLE_ID,
    tenant: TENANT,
    name: 'T1',
    status: 'available',
    currentTabId: null,
    deleteOne: async () => { deleted = true; },
  }));

  const r = res();
  await pt.deleteTable(req({ params: { id: String(TABLE_ID) } }), r, boom);

  assert.ok(!r.code, 'no error status expected');
  assert.equal(r.body.success, true);
  assert.equal(deleted, true);
});

test('deleteTable returns 404 for a table outside the tenant', async (t) => {
  t.mock.method(POSTable, 'findOne', () => chainable(null));

  const r = res();
  await pt.deleteTable(req({ params: { id: String(TABLE_ID) } }), r, boom);

  assert.equal(r.code, 404);
});

// ─── listTables ──────────────────────────────────────────────────────────────

test('listTables pairs each occupied table with a tab summary in one Order query', async (t) => {
  const openedAt = new Date('2026-08-20T19:05:00Z');
  const freeRow = {
    _id: oid(), name: 'T1', section: 'Main', seats: 4, sortOrder: 0,
    status: 'available', currentTabId: null,
  };
  const busyRow = {
    _id: oid(), name: 'T2', section: 'Main', seats: 2, sortOrder: 1,
    status: 'occupied', currentTabId: TAB_ID,
  };

  t.mock.method(POSTable, 'find', () => chainable([freeRow, busyRow]));
  const orderFind = t.mock.method(Order, 'find', (filter) => {
    assert.ok(filter._id.$in.some((id) => String(id) === String(TAB_ID)),
      'the held order ids must be fetched with a single $in query');
    return chainable([{
      _id: TAB_ID,
      items: [{}, {}],
      holdMetadata: { guests: 4, openedAt },
      createdAt: new Date('2026-08-20T19:00:00Z'),
    }]);
  });

  const r = res();
  await pt.listTables(req(), r, boom);

  assert.equal(orderFind.mock.callCount(), 1, 'exactly one query for all tabs');
  const [free, busy] = r.body.data.tables;

  assert.equal(free.tab, null, 'a table with no tab must report null, not {}');
  assert.deepEqual(busy.tab, {
    orderId: TAB_ID,
    guests: 4,
    openedAt,
    itemCount: 2,
  });
});

test('listTables falls back to createdAt when the tab never recorded openedAt', async (t) => {
  const createdAt = new Date('2026-08-20T18:30:00Z');
  t.mock.method(POSTable, 'find', () => chainable([{
    _id: oid(), name: 'T3', section: 'Main', seats: 4, sortOrder: 0,
    status: 'occupied', currentTabId: TAB_ID,
  }]));
  t.mock.method(Order, 'find', () => chainable([{
    _id: TAB_ID,
    items: [],
    holdMetadata: null,
    createdAt,
  }]));

  const r = res();
  await pt.listTables(req(), r, boom);

  assert.equal(r.body.data.tables[0].tab.guests, undefined);
  assert.equal(new Date(r.body.data.tables[0].tab.openedAt).getTime(), createdAt.getTime());
});

// ─── the venue gate ──────────────────────────────────────────────────────────

test('every handler answers 400 venue mode disabled when the flag is off', async (t) => {
  const find = t.mock.method(POSTable, 'find', () => chainable([]));
  const create = t.mock.method(POSTable, 'create', async () => ({}));
  const findOne = t.mock.method(POSTable, 'findOne', () => chainable(null));

  for (const handler of [pt.listTables, pt.createTable, pt.updateTable, pt.deleteTable]) {
    const r = res();
    await handler(req({ tenant: {} }), r, boom);

    assert.equal(r.code, 400, `${handler.name} must refuse without venue mode`);
    assert.equal(r.body.message, 'venue mode disabled');
  }

  assert.equal(find.mock.callCount() + create.mock.callCount() + findOne.mock.callCount(), 0,
    'a blocked venue gate must touch no collections');
});
