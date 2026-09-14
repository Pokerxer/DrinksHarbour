const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const POSSession = require('../models/POSSession');
const Warehouse = require('../models/Warehouse');
const Order = require('../models/Order');
const pos = require('../controllers/pos.controller');
const id = () => new mongoose.Types.ObjectId();
const tenantId = id(), staffId = id(), shopA = String(id()), shopB = String(id()), warehouse = id();
const tenant = { _id: tenantId, posSettings: { shops: [shopA, shopB].map(_id => ({ _id, name: _id, mode: 'retail', warehouse })) } };
function query(value) {
  const q = { populate: () => q, sort: () => q, select: () => q, skip: () => q, limit: () => q, lean: async () => value,
    then: (ok, no) => Promise.resolve(value).then(ok, no) }; return q;
}
function response() { return { status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } }; }
async function invoke(handler, req) {
  const res = response(); let error;
  await handler({ tenant, user: { _id: staffId }, posUser: { _id: staffId }, posPermissions: ['pos:sell'], query: {}, params: {}, ...req }, res, e => { error = e; });
  if (error) throw error;
  return res;
}
test('two retail-mode shops open independent sessions', async t => {
  const rows = [];
  t.mock.method(Warehouse, 'findOne', () => query({ _id: warehouse }));
  t.mock.method(POSSession, 'findOne', filter => query(rows.find(row =>
    Object.entries(filter).every(([k, v]) => row[k] === v)) || null));
  t.mock.method(POSSession, 'create', async data => {
    const row = { ...data, _id: id(), populate: async () => {} }; rows.push(row); return row;
  });
  const a = await invoke(pos.openSession, { body: { shopId: shopA } });
  const b = await invoke(pos.openSession, { body: { shopId: shopB } });
  assert.equal(a.code, 201); assert.equal(b.code, 201);
  assert.equal(rows[0].shopId, shopA); assert.equal(rows[1].shopId, shopB);
});
test('current-session lookup cannot select the other shop', async t => {
  t.mock.method(POSSession, 'findOne', filter => query(filter.shopId === shopA ? { _id: 'A', shopId: shopA } : { _id: 'B', shopId: shopB }));
  const res = await invoke(pos.getCurrentSession, { query: { shopId: shopA } });
  assert.equal(res.body.data.session._id, 'A');
});
test('back-office session history includes closed custom and legacy drawers, scoped to tenant', async t => {
  const history = [{ _id: 'old-cbl', shopId: shopA, status: 'closed' }, { _id: 'old-legacy', status: 'closed' }];
  const filters = [];
  t.mock.method(POSSession, 'find', filter => { filters.push(filter); return query(history); });
  t.mock.method(POSSession, 'countDocuments', async filter => { filters.push(filter); return history.length; });
  const res = await invoke(pos.getSessionList, { posUser: undefined, query: { shopId: 'all' } });
  assert.equal(res.body.data.sessions.length, 2);
  assert.equal(res.body.data.total, 2);
  for (const filter of filters) {
    assert.equal(filter.tenant, tenantId);
    assert.equal(Object.hasOwn(filter, 'shopId'), false);
    assert.equal(Object.hasOwn(filter, 'status'), false);
  }
});
test('checkout rejects an explicit session from another shop before touching orders', async t => {
  t.mock.method(POSSession, 'findOne', () => query(null));
  t.mock.method(Order, 'countDocuments', () => { throw new Error('order numbering was reached before session validation'); });
  await assert.rejects(invoke(pos.createPOSOrder, { body: { shopId: shopA, sessionId: String(id()), items: [{}], paymentMethod: 'cash' } }), /open session/i);
});
test('closing control counts only orders linked to its session, including split cash', async t => {
  const sessionId = id();
  t.mock.method(POSSession, 'findOne', filter => query(filter.shopId === shopA ? { _id: sessionId, shopId: shopA, openingCash: 200, openedAt: new Date(), status: 'open' } : null));
  t.mock.method(Order, 'find', filter => query(String(filter.posSessionId) === String(sessionId) ? [
    { totalAmount: 1000, paymentStatus: 'paid', paymentMethod: 'split', paymentDetails: { splitPayments: [{ method: 'cash', amount: 300 }, { method: 'card', amount: 700 }] } },
  ] : [{ totalAmount: 9000, paymentStatus: 'paid', paymentMethod: 'cash' }]));
  const res = await invoke(pos.getClosingControl, { params: { id: String(sessionId) }, query: { shopId: shopA } });
  assert.equal(res.body.data.methods.find(m => m.method === 'cash').theoretical, 500);
});
test('a wrong-shop session cannot be closed', async t => {
  const rows = [{ _id: 'session-b', tenant: tenantId, shopId: shopB, status: 'open' }];
  t.mock.method(POSSession, 'findOneAndUpdate', filter => query(rows.find(r => r.shopId === filter.shopId) || null));
  t.mock.method(POSSession, 'findOne', filter => query(rows.find(r => r.shopId === filter.shopId) || null));
  const res = await invoke(pos.closeSession, { body: {}, params: { id: 'session-b' }, query: { shopId: shopA } });
  assert.equal(res.code, 404); assert.equal(rows[0].status, 'open');
});
test('shop selection cannot use a query operator or conflicting body ownership', async () => {
  await assert.rejects(invoke(pos.getCurrentSession, { query: { shopId: { $ne: null } } }), /Select a POS shop/);
  await assert.rejects(invoke(pos.getCurrentSession, { query: { shopId: shopA }, body: { shopId: shopB } }), /Conflicting/);
});
