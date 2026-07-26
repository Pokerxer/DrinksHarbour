// server/__tests__/orderAdminList.test.js
//
// Regressions for the admin Orders screens (/ecommerce/orders and /ecommerce/orders/[id]):
//
//  1. getAllOrders threw `TypeError: object is not iterable` for tenant admins —
//     the status-count pipeline did `[...statusMatch]` where statusMatch was a
//     plain `{ $match }` object, so the whole list endpoint 500'd for them.
//  2. The status cards were fed `counts.all = total` (the *filtered* total), so
//     picking "Delivered" made the All Orders card show the delivered count, and
//     the per-status counts ignored search / payment / date filters entirely.
//  3. `sort=orderNumber` silently fell through to placedAt.
//  4. getOrder only admitted platform admins, so a tenant admin could see an
//     order in the list but got 403 opening its detail page.
const test = require('node:test');
const assert = require('node:assert');

const mongoose = require('mongoose');
const Order = require('../models/Order');
const orderController = require('../controllers/order.controller');

// ── Model stubs ──────────────────────────────────────────────────────────────

function stubList({ docs = [], total = 0, statusCounts = [] } = {}) {
  const original = {
    find: Order.find,
    countDocuments: Order.countDocuments,
    aggregate: Order.aggregate,
  };
  const captured = { findFilter: null, sort: null, countFilter: null, pipeline: null };

  const chain = {
    sort(v)     { captured.sort = v; return chain; },
    skip()      { return chain; },
    limit()     { return chain; },
    populate()  { return chain; },
    lean: async () => docs,
  };

  Order.find = (filter) => { captured.findFilter = filter; return chain; };
  Order.countDocuments = async (filter) => { captured.countFilter = filter; return total; };
  Order.aggregate = async (pipeline) => { captured.pipeline = pipeline; return statusCounts; };

  return {
    captured,
    restore() { Object.assign(Order, original); },
  };
}

function stubFindById(doc) {
  const original = Order.findById;
  const chain = {
    populate() { return chain; },
    then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); },
  };
  Order.findById = () => chain;
  return { restore() { Order.findById = original; } };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// asyncHandler funnels thrown errors into next() — capture instead of swallowing.
async function run(handler, req) {
  const res = mockRes();
  let err = null;
  await handler(req, res, (e) => { err = e; });
  if (err) throw err;
  return res;
}

const TENANT_A = '650000000000000000000001';
const TENANT_B = '650000000000000000000002';
const USER_ID  = '650000000000000000000009';

const tenantAdminReq = (query = {}) => ({
  query,
  user: { _id: { toString: () => USER_ID }, role: 'tenant_admin', tenant: TENANT_A },
});

const superAdminReq = (query = {}) => ({
  query,
  user: { _id: { toString: () => USER_ID }, role: 'super_admin' },
});

// ── getAllOrders ─────────────────────────────────────────────────────────────

test('getAllOrders does not blow up for tenant admins and scopes to their tenant', async () => {
  const stub = stubList({ docs: [], total: 0, statusCounts: [{ _id: 'pending', count: 2 }] });
  try {
    const res = await run(orderController.getAllOrders, tenantAdminReq());
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(String(stub.captured.findFilter['items.tenant']), TENANT_A);
    // The aggregate must receive a real pipeline array with the tenant $match.
    assert.ok(Array.isArray(stub.captured.pipeline));
    assert.strictEqual(String(stub.captured.pipeline[0].$match['items.tenant']), TENANT_A);
  } finally {
    stub.restore();
  }
});

test('tenant scoping casts the tenant id to an ObjectId for the aggregation', async () => {
  // Order.find() casts a string id for you; $match does not. Leaving it as a
  // string made every status card read 0 while the table showed real rows.
  const stub = stubList({ total: 4, statusCounts: [] });
  try {
    await run(orderController.getAllOrders, tenantAdminReq());
    const matched = stub.captured.pipeline[0].$match['items.tenant'];
    assert.ok(matched instanceof mongoose.Types.ObjectId, 'aggregate $match needs a real ObjectId');
    assert.strictEqual(matched.toString(), TENANT_A);
    // find() must be given the same value so both queries agree
    assert.strictEqual(stub.captured.findFilter['items.tenant'].toString(), TENANT_A);
  } finally {
    stub.restore();
  }
});

test('an uncastable tenant id matches nothing rather than everything', async () => {
  const stub = stubList({ total: 0, statusCounts: [] });
  try {
    await run(orderController.getAllOrders, {
      query: {},
      user: { _id: { toString: () => USER_ID }, role: 'tenant_admin', tenant: 'not-an-object-id' },
    });
    const matched = stub.captured.findFilter['items.tenant'];
    assert.ok(matched instanceof mongoose.Types.ObjectId);
    assert.notStrictEqual(matched.toString(), 'not-an-object-id');
  } finally {
    stub.restore();
  }
});

test('status counts survive a status filter and all = sum of every status', async () => {
  const stub = stubList({
    docs: [],
    total: 3, // countDocuments with status=delivered applied
    statusCounts: [
      { _id: 'pending',   count: 5 },
      { _id: 'delivered', count: 3 },
      { _id: 'cancelled', count: 1 },
    ],
  });
  try {
    const res = await run(orderController.getAllOrders, superAdminReq({ status: 'delivered' }));
    const { counts, pagination } = res.body.data;

    assert.strictEqual(counts.all, 9, 'All Orders card must count every status, not just the filtered one');
    assert.strictEqual(counts.pending, 5);
    assert.strictEqual(counts.delivered, 3);
    assert.strictEqual(pagination.total, 3, 'pagination total stays scoped to the active filter');

    // The paged query is filtered by status; the counts pipeline is not.
    assert.strictEqual(stub.captured.findFilter.status, 'delivered');
    assert.strictEqual(stub.captured.pipeline[0].$match.status, undefined);
  } finally {
    stub.restore();
  }
});

test('search and payment filters flow into the status-count pipeline', async () => {
  const stub = stubList({ statusCounts: [] });
  try {
    await run(orderController.getAllOrders, superAdminReq({ search: 'ada', payment: 'paid', status: 'shipped' }));
    const match = stub.captured.pipeline[0].$match;
    assert.strictEqual(match.paymentStatus, 'paid');
    assert.ok(Array.isArray(match.$or) && match.$or.length > 0, 'search must narrow the counts too');
    assert.strictEqual(match.status, undefined);
  } finally {
    stub.restore();
  }
});

test('search escapes regex metacharacters instead of building a broken pattern', async () => {
  const stub = stubList();
  try {
    await run(orderController.getAllOrders, superAdminReq({ search: 'DH-2026(1)' }));
    const re = stub.captured.findFilter.$or[0].orderNumber;
    assert.ok(re instanceof RegExp);
    assert.ok(re.test('DH-2026(1)'), 'literal match still works');
  } finally {
    stub.restore();
  }
});

test('sort=orderNumber actually sorts by orderNumber; unknown fields fall back to placedAt', async () => {
  const stub = stubList();
  try {
    await run(orderController.getAllOrders, superAdminReq({ sort: 'orderNumber', order: 'asc' }));
    assert.deepStrictEqual(stub.captured.sort, { orderNumber: 1 });

    await run(orderController.getAllOrders, superAdminReq({ sort: 'nonsense' }));
    assert.deepStrictEqual(stub.captured.sort, { placedAt: -1 });

    await run(orderController.getAllOrders, superAdminReq({ sort: 'total' }));
    assert.deepStrictEqual(stub.captured.sort, { totalAmount: -1 });
  } finally {
    stub.restore();
  }
});

test('source filter narrows to POS/web orders', async () => {
  const stub = stubList();
  try {
    await run(orderController.getAllOrders, superAdminReq({ source: 'pos' }));
    assert.strictEqual(stub.captured.findFilter.source, 'pos');
  } finally {
    stub.restore();
  }
});

// ── getOrder ─────────────────────────────────────────────────────────────────

const orderDoc = (tenantId) => ({
  _id: 'order1',
  user: null,
  items: [{ tenant: { _id: tenantId, name: 'Vendor' } }],
  shippingAddress: { email: 'buyer@example.com' },
});

test('getOrder lets a tenant admin open an order containing their own items', async () => {
  const stub = stubFindById(orderDoc(TENANT_A));
  try {
    const res = await run(orderController.getOrder, {
      params: { id: 'order1' },
      query: {},
      user: { _id: { toString: () => USER_ID }, role: 'tenant_admin', tenant: TENANT_A },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
  } finally {
    stub.restore();
  }
});

test('getOrder still blocks a tenant admin from another tenant’s order', async () => {
  const stub = stubFindById(orderDoc(TENANT_B));
  try {
    const res = await run(orderController.getOrder, {
      params: { id: 'order1' },
      query: {},
      user: { _id: { toString: () => USER_ID }, role: 'tenant_admin', tenant: TENANT_A },
    });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
  } finally {
    stub.restore();
  }
});

test('getOrder still admits platform admins and the order owner', async () => {
  let stub = stubFindById(orderDoc(TENANT_B));
  try {
    const res = await run(orderController.getOrder, {
      params: { id: 'order1' }, query: {},
      user: { _id: { toString: () => USER_ID }, role: 'super_admin' },
    });
    assert.strictEqual(res.statusCode, 200);
  } finally {
    stub.restore();
  }

  stub = stubFindById({ ...orderDoc(TENANT_B), user: USER_ID });
  try {
    const res = await run(orderController.getOrder, {
      params: { id: 'order1' }, query: {},
      user: { _id: { toString: () => USER_ID }, role: 'customer' },
    });
    assert.strictEqual(res.statusCode, 200);
  } finally {
    stub.restore();
  }
});

// ── resolveOrderRecipient ────────────────────────────────────────────────────
//
// Guest orders have no `order.customer` (the field does not exist on the
// schema), so status-change notifications from the detail page were skipped
// entirely — the SMS/WhatsApp senders already fall back to
// shippingAddress.phone, but the caller bailed before ever reaching them.

const { resolveOrderRecipient } = require('../utils/orderUtils');

test('resolveOrderRecipient reads the web-checkout buyer off shippingAddress', async () => {
  const recipient = await resolveOrderRecipient({
    shippingAddress: { fullName: 'Ada Grace Obi', email: 'ada@example.com', phone: '08030000000' },
  });
  assert.strictEqual(recipient.firstName, 'Ada');
  assert.strictEqual(recipient.lastName, 'Grace Obi');
  assert.strictEqual(recipient.phone, '08030000000');
  assert.strictEqual(recipient.email, 'ada@example.com');
});

test('resolveOrderRecipient falls back to the POS customer snapshot', async () => {
  const recipient = await resolveOrderRecipient({
    shippingAddress: undefined,
    paymentDetails: { customer: { firstName: 'Walk', lastName: 'In', phone: '08041111111' } },
  });
  assert.strictEqual(recipient.firstName, 'Walk');
  assert.strictEqual(recipient.phone, '08041111111');
});

test('resolveOrderRecipient defaults the name when the address has no fullName', async () => {
  const recipient = await resolveOrderRecipient({ shippingAddress: { phone: '08050000000' } });
  assert.strictEqual(recipient.firstName, 'Customer');
  assert.strictEqual(recipient.lastName, '');
});

test('resolveOrderRecipient returns null when there is nobody to reach', async () => {
  assert.strictEqual(await resolveOrderRecipient({ shippingAddress: {}, paymentDetails: {} }), null);
  assert.strictEqual(await resolveOrderRecipient(null), null);
});
