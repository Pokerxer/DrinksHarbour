// server/__tests__/salesOrderListFilters.test.js
//
// The `?filters=` param on GET /api/sales-orders is merged into the same query
// object that carries the tenant scope. These tests drive the REAL handler and
// assert on the query object handed to SalesOrder.find — the thing that decides
// which documents a tenant is shown. Asserting on buildFilterQuery's return
// value alone would miss the merge, which is where the tenant scope was lost.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const ctrl = require('../controllers/salesOrder.controller');

const oid = () => new mongoose.Types.ObjectId();

// A stub Mongoose query. It must be chainable AND thenable: the list handler
// awaits `find(q).sort().populate().skip().limit().lean()`, and elsewhere in
// this controller queries are awaited without .lean() — a merely-truthy chain
// object is then mistaken for a document and costs a 10s buffering timeout.
function stubQuery(rows, calls = {}) {
  const q = {};
  for (const m of ['sort', 'populate', 'skip', 'limit', 'select']) {
    q[m] = (...args) => { (calls[m] ||= []).push(args); return q; };
  }
  q.lean = async () => rows;
  q.then = (onOk, onErr) => Promise.resolve(rows).then(onOk, onErr);
  return q;
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// Runs getSalesOrders and hands back the query object it built.
async function listQuery(t, query, { tenantId = oid(), rows = [] } = {}) {
  let captured = null;
  const calls = {};
  t.mock.method(SalesOrder, 'find', (q) => { captured = q; return stubQuery(rows, calls); });
  t.mock.method(SalesOrder, 'countDocuments', async () => rows.length);

  const res = makeRes();
  await ctrl.getSalesOrders(
    { query, tenant: { _id: tenantId }, user: { role: 'tenant_admin', _id: oid() } },
    res,
    (err) => { if (err) throw err; },
  );
  return { query: captured, res, calls, tenantId };
}

const asFilters = (arr) => JSON.stringify(arr);

test('a filters payload cannot move the query off the caller\'s own tenant', async (t) => {
  const mine = oid();
  const theirs = oid();

  const { query } = await listQuery(
    t,
    { filters: asFilters([{ field: 'tenant', operator: 'equals', value: String(theirs) }]) },
    { tenantId: mine },
  );

  assert.strictEqual(
    String(query.tenant),
    String(mine),
    'the tenant scope must survive the filter merge',
  );
});

test('a filters payload cannot replace the tenant scope with an $ne that matches everything', async (t) => {
  const mine = oid();

  const { query } = await listQuery(
    t,
    { filters: asFilters([{ field: 'tenant', operator: 'not_equals', value: String(oid()) }]) },
    { tenantId: mine },
  );

  assert.strictEqual(String(query.tenant), String(mine));
});

test('a filter on a field that is not a SalesOrder schema path is dropped, not passed through', async (t) => {
  const { query } = await listQuery(t, {
    filters: asFilters([{ field: 'salesTeam', operator: 'equals', value: 'North' }]),
  });

  assert.ok(
    !('salesTeam' in query),
    'an unknown field silently matches nothing — an empty list that looks like a real answer',
  );
});

test('_id and __v are not filterable', async (t) => {
  const { query } = await listQuery(t, {
    filters: asFilters([
      { field: '_id', operator: 'equals', value: String(oid()) },
      { field: '__v', operator: 'equals', value: 0 },
    ]),
  });

  assert.ok(!('_id' in query));
  assert.ok(!('__v' in query));
});

test('the filter shape the admin UI sends reaches the query', async (t) => {
  // What advanced-search emits: a UI identity (fieldId) plus the document path.
  const { query } = await listQuery(t, {
    filters: asFilters([
      { fieldId: 'payment_status', field: 'paymentStatus', operator: 'equals', value: 'partial', label: 'Payment: partial' },
    ]),
  });

  assert.strictEqual(query.paymentStatus, 'partial');
});

test('a partially-paid order is reachable through the paymentStatus param', async (t) => {
  const { query } = await listQuery(t, { paymentStatus: 'partial', docType: 'order' });

  assert.strictEqual(query.paymentStatus, 'partial');
  assert.strictEqual(query.docType, 'order');
});

test('a nested snapshot path stays filterable', async (t) => {
  const { query } = await listQuery(t, {
    filters: asFilters([
      { fieldId: 'customer', field: 'customerSnapshot.name', operator: 'contains', value: 'Ada' },
    ]),
  });

  assert.deepStrictEqual(query['customerSnapshot.name'], { $regex: 'Ada', $options: 'i' });
});
