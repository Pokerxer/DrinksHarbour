'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('generic_shipment_never_mutates_canonical_order', async () => {
  let saves = 0;
  const order = { venueIdentityVersion: 1, status: 'pending', items: [], save: async () => saves++ };
  await assert.rejects(require('../services/orderStatus.service').applyOrderStatus(order, 'shipped'), /canonical/i);
  assert.equal(saves, 0); assert.equal(order.status, 'pending');
});
for (const handler of ['cancelOrder', 'updatePaymentStatus']) test(`generic_${handler}_never_mutates_canonical_order`, async t => {
  let saves = 0, error;
  const order = { _id: 'order', tenant: 'own', venueIdentityVersion: 1, status: 'pending', items: [], save: async () => saves++ };
  t.mock.method(require('../models/Order'), 'findById', async () => order);
  const res = { status() { return this; }, json() { return this; } };
  await require('../controllers/order.controller')[handler]({ params: { id: 'order' }, body: { action: 'mark_paid' }, user: { _id: 'admin', role: 'super_admin' } }, res, value => { error = value; });
  assert.equal(error?.code, 'VENUE_CANONICAL_CHECKOUT_REQUIRED'); assert.equal(saves, 0);
});
