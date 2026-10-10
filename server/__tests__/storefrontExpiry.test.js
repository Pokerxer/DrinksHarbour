'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Checkout = require('../models/IntegrationCheckout');
const settlement = require('../services/storefrontSettlement');
const { sweepCheckouts } = require('../jobs/integrationCheckout.job');
test('cleanup selects only old unpaid checkouts and reconciles before releasing', async t => {
  t.mock.method(Checkout, 'find', filter => {
    assert.ok(filter.createdAt.$lt instanceof Date);
    assert.ok(!filter.state.$in.includes('paid'));
    return { sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => [{ _id: 'checkout', tenant: 'tenant', apiKey: 'key' }] };
  });
  t.mock.method(Checkout, 'updateOne', async () => ({ modifiedCount: 1 }));
  let cancelled = false;
  t.mock.method(settlement, 'cancelCheckout', async (tenant, key, id) => { cancelled = true; assert.equal(id, 'checkout'); });
  await sweepCheckouts();
  assert.equal(cancelled, true);
});
test('paid integration orders with unposted accounting are recovered with real documents', async t => {
  const Order = require('../models/Order');
  const order = new Order({ integrationCheckout: 'checkout', paymentStatus: 'paid', tenant: 'a'.repeat(24) });
  t.mock.method(Order, 'find', filter => {
    assert.equal(filter.accountingStatus, 'pending');
    assert.equal(filter.integrationCheckout.$type, 'string');
    return { limit: async () => [order] };
  });
  let posted = false;
  t.mock.method(require('../services/accounting.orders'), 'captureOrderAccounting', async doc => { assert.equal(doc, order); posted = true; });
  await require('../jobs/integrationCheckout.job').reconcileCheckoutAccounting();
  assert.equal(posted, true);
});
