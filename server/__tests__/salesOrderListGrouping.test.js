// server/__tests__/salesOrderListGrouping.test.js
//
// The grouped path drops pagination entirely — the client sends no page/limit
// when groupBy is set. These tests pin what that fetch is allowed to ask Mongo
// for, and require the response to SAY when it stopped short. A silent
// truncation reads as "that is all of them", which is how a partial answer
// becomes a wrong one.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const ctrl = require('../controllers/salesOrder.controller');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

function stubQuery(rows, calls) {
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

function orderRow(i) {
  return {
    _id: oid(),
    soNumber: `SO2026081${String(i).padStart(4, '0')}`,
    docType: 'order',
    salesperson: i % 2 ? 'Ada Lovelace' : 'Grace Hopper',
    currency: 'NGN',
    total: 1000 + i,
    createdAt: new Date('2026-08-16T10:00:00Z'),
  };
}

async function listGrouped(t, { rows, countDocuments }) {
  const calls = {};
  t.mock.method(SalesOrder, 'find', () => stubQuery(rows, calls));
  t.mock.method(SalesOrder, 'countDocuments', async () => countDocuments ?? rows.length);

  const res = makeRes();
  await ctrl.getSalesOrders(
    { query: { groupBy: 'salesperson' }, tenant: { _id: oid() }, user: { role: 'tenant_admin' } },
    res,
    (err) => { if (err) throw err; },
  );
  return { res, calls };
}

test('the grouped fetch does not pull line items, notes or addresses', async (t) => {
  const { calls } = await listGrouped(t, { rows: [orderRow(1)] });

  const projection = (calls.select || []).flat().join(' ');
  for (const heavy of ['items', 'notes', 'terms', 'invoiceAddress', 'deliveryAddress', 'fulfillments']) {
    assert.match(
      projection,
      new RegExp(`-${heavy}\\b`),
      `the list never renders ${heavy}; grouping must not fetch it for every order in the tenant`,
    );
  }
});

test('the grouped fetch is bounded', async (t) => {
  const { calls } = await listGrouped(t, { rows: [orderRow(1)] });

  assert.ok(calls.limit && calls.limit.length > 0, 'grouping must cap how many orders it loads');
  assert.ok(Number(calls.limit[0][0]) > 0);
});

test('a grouped response that stopped short says so, with the true total', async (t) => {
  const cap = svc.GROUP_FETCH_CAP;
  const rows = Array.from({ length: cap }, (_, i) => orderRow(i));

  const { res } = await listGrouped(t, { rows, countDocuments: cap + 137 });

  assert.strictEqual(res.body.truncated, true);
  assert.strictEqual(res.body.total, cap + 137, 'the caller must be told how many it did not get');
  assert.strictEqual(res.body.fetched, cap);
});

test('a grouped response that got everything is not flagged as truncated', async (t) => {
  const rows = [orderRow(1), orderRow(2), orderRow(3)];

  const { res } = await listGrouped(t, { rows });

  assert.strictEqual(res.body.truncated, false);
  assert.strictEqual(res.body.total, 3);
});

test('grouping by payment status separates partial from unpaid and paid', async (t) => {
  // The whole point of the enum widening: a partially-settled order must not
  // fall into the same bucket as one nothing has been collected on.
  const extract = svc.groupByExtractor('paymentStatus');

  assert.strictEqual(extract({ paymentStatus: 'partial' }), 'Partial');
  assert.strictEqual(extract({ paymentStatus: 'unpaid' }), 'Unpaid');
  assert.strictEqual(extract({ paymentStatus: 'paid' }), 'Paid');
  assert.strictEqual(extract({}), 'Unpaid', 'an order written before the field is unpaid, never paid');
});

test('grouping by order status keeps a cancelled order out of the live buckets', async (t) => {
  const extract = svc.groupByExtractor('orderStatus');

  assert.strictEqual(extract({ orderStatus: 'cancelled' }), 'Cancelled');
  assert.strictEqual(extract({ orderStatus: 'partially_fulfilled' }), 'Partially Fulfilled');
  assert.strictEqual(extract({ orderStatus: undefined }), 'Draft');
});

test('grouping still groups — the response shape the list renders is unchanged', async (t) => {
  const rows = [orderRow(1), orderRow(2), orderRow(3)];

  const { res } = await listGrouped(t, { rows });

  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.groups));
  const ada = res.body.groups.find((g) => g._id === 'Ada Lovelace');
  assert.strictEqual(ada.count, 2);
  assert.strictEqual(ada.total, (1000 + 1) + (1000 + 3));
  assert.strictEqual(ada.docs.length, 2);
});
