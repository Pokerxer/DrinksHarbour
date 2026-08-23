// server/__tests__/stockTransfer.gating.test.js
// Pure pieces only: the transitions table and the side-gate decision. HTTP
// wiring is covered by Task 4's service tests + manual smoke in Task 8.
const test = require('node:test');
const assert = require('node:assert/strict');

const ctrlPath = require.resolve('../controllers/stockTransfer.controller');

test('transitions map encodes the two-sided lifecycle', () => {
  delete require.cache[ctrlPath];
  const ctrl = require(ctrlPath);
  const T = ctrl.TRANSITIONS;
  assert.deepEqual(T.confirmed, ['in_transit', 'cancelled']);
  assert.deepEqual(T.in_transit, ['cancelled']);
  assert.deepEqual(T.partially_received, []);
  assert.ok(!T.confirmed.includes('completed'), 'legacy direct complete removed');
});

test('manager gate allows listed managers and tenant admins, rejects others', () => {
  delete require.cache[ctrlPath];
  const { isWarehouseSideUser } = require(ctrlPath);
  const wh = { managers: ['u1'] };
  assert.equal(isWarehouseSideUser(wh, { user: { _id: 'u1', role: 'tenant_staff' } }), true);
  assert.equal(isWarehouseSideUser(wh, { user: { _id: 'u2', role: 'tenant_staff' } }), false);
  assert.equal(isWarehouseSideUser(wh, { user: { _id: 'u2', role: 'tenant_admin' } }), true);
  assert.equal(isWarehouseSideUser(null, { user: { _id: 'u2', role: 'tenant_owner' } }), true);
});
