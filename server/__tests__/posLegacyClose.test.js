const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeLegacyClose } = require('../controllers/pos/legacy-session.controller');

function run(overrides = {}) {
  const req = { tenant: { _id: 'tenant' }, user: { role: 'tenant_owner' }, body: { shopId: 'legacy', countedBalances: [{ method: 'cash', counted: 0 }] }, query: {}, ...overrides };
  let continued = false;
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  authorizeLegacyClose(req, res, () => { continued = true; });
  return { req, res, continued };
}
test('back-office tenant owner can reconcile legacy cash including a counted zero', () => {
  assert.equal(run().continued, true);
});
test('legacy close does not broaden back-office staff permissions', () => {
  const result = run({ user: { role: 'tenant_staff' } });
  assert.equal(result.continued, false); assert.equal(result.res.code, 403);
});
test('authenticated cashier retains legacy reconciliation access', () => {
  assert.equal(run({ user: { role: 'tenant_staff' }, posUser: { _id: 'cashier' }, posPermissions: ['pos:sell'] }).continued, true);
});
test('legacy close cannot target a shop drawer or omit actual cash count', () => {
  for (const body of [{ shopId: 'retail', countedBalances: [{ method: 'cash', counted: 0 }] }, {}, { countedBalances: [{ method: 'cash', counted: -1 }] }, { countedBalances: [{ method: 'cash', counted: '' }] }]) {
    const result = run({ body });
    assert.equal(result.continued, false); assert.equal(result.res.code, 400);
  }
});
test('conflicting query scope and cashiers without selling access are rejected', () => {
  assert.equal(run({ query: { shopId: 'retail' } }).res.code, 400);
  assert.equal(run({ posUser: { _id: 'cashier' }, posPermissions: [] }).res.code, 403);
  assert.equal(run({ tenant: null }).res.code, 403);
});
test('actual counted cash must be a finite nonnegative number, never a default', () => {
  for (const counted of [undefined, null, '', '0', -1, NaN, Infinity]) {
    const result = run({ body: { shopId: 'legacy', countedBalances: [{ method: 'cash', counted }] } });
    assert.equal(result.res.code, 400);
    assert.equal(result.continued, false);
  }
});
test('legacy close handler scopes both lookups to tenant and unassigned sessions', async t => {
  const POSSession = require('../models/POSSession');
  const { closeSession } = require('../controllers/pos/sessions-close.controller');
  const filters = [];
  t.mock.method(POSSession, 'findOneAndUpdate', async filter => { filters.push(filter); return null; });
  t.mock.method(POSSession, 'findOne', filter => { filters.push(filter); return { lean: async () => null }; });
  const req = run().req;
  Object.assign(req, { method: 'POST', originalUrl: '/api/pos/sessions/assigned-id/close-legacy', params: { id: 'assigned-id' } });
  const res = { status(code) { this.code = code; return this; }, json() { return this; } };
  await closeSession(req, res, error => { throw error; });
  assert.equal(res.code, 404);
  assert.equal(filters.length, 2);
  for (const filter of filters) {
    assert.equal(filter.tenant, 'tenant');
    assert.equal(filter.shopId, null);
    assert.equal(filter._id, 'assigned-id');
  }
});
