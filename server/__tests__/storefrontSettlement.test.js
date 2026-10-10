'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Checkout = require('../models/IntegrationCheckout');
const Order = require('../models/Order');
const service = require('../services/storefrontSettlement');
const stock = require('../services/storefrontStock');
const gateway = require('../services/storefrontGateway');
const row = { _id: 'a'.repeat(64), order: 'b'.repeat(24), apiKey: 'c'.repeat(24), tenant: 'd'.repeat(24),
  reference: 'ref', amountKobo: 500000, state: 'ready' };
const payment = { reference: 'ref', status: 'success', amount: 5000, currency: 'NGN', transactionId: '1' };
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
function setup(t, checkout = row, order = { _id: row.order, status: 'pending', paymentStatus: 'pending', items: [] }) {
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
  t.mock.method(Checkout, 'findOne', () => query(checkout));
  t.mock.method(Order, 'findOne', () => query(order));
}
test('settlement rejects amount/currency/reference mismatch without writing an order', async t => {
  setup(t);
  for (const change of [{ amount: 1 }, { currency: 'USD' }, { reference: 'foreign' }, { status: 'failed' }]) {
    await assert.rejects(service.settlePayment('ref', { ...payment, ...change }), e => e.statusCode === 409);
  }
});
test('verified settlement transitions order and ledger atomically, and replay is a no-op', async t => {
  setup(t);
  let write;
  t.mock.method(Order, 'updateOne', async (filter, update) => { assert.equal(filter.tenant, row.tenant); write = update.$set; return { modifiedCount: 1 }; });
  t.mock.method(Checkout, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(require('../services/accounting.orders'), 'captureOrderAccounting', async doc => { assert.ok(doc instanceof Order); });
  await service.settlePayment('ref', payment);
  assert.equal(write.paymentStatus, 'paid'); assert.equal(write.status, 'confirmed');
  Checkout.findOne = () => query({ ...row, state: 'paid' });
  Order.updateOne = async () => { throw Error('Replay wrote order'); };
  await service.settlePayment('ref', payment);
});
test('cancelled orders receiving late payments require review instead of fulfillment', async t => {
  setup(t, { ...row, state: 'cancelled' }, { _id: row.order, status: 'cancelled', paymentStatus: 'pending' });
  let write, state;
  t.mock.method(Order, 'updateOne', async (filter, update) => { write = update.$set; return { modifiedCount: 1 }; });
  t.mock.method(Checkout, 'updateOne', async (filter, update) => { state = update.$set.state; return { modifiedCount: 1 }; });
  await service.settlePayment('ref', payment);
  assert.equal(state, 'needs_review'); assert.equal(write.accountingStatus, 'needs_review');
  assert.notEqual(write.status, 'confirmed');
});
test('cancellation never releases stock for an ongoing payment', async t => {
  setup(t);
  t.mock.method(gateway, 'verify', async () => ({ status: 'ongoing', reference: 'ref' }));
  await assert.rejects(service.cancelCheckout({ _id: row.tenant }, { _id: row.apiKey }, row._id), e => e.statusCode === 409);
});
test('failed checkout cancellation releases stock once inside the transaction', async t => {
  setup(t);
  t.mock.method(gateway, 'verify', async () => ({ status: 'failed', reference: 'ref' }));
  let released = 0;
  t.mock.method(stock, 'releaseStock', async () => { released++; });
  t.mock.method(Order, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(Checkout, 'updateOne', async () => ({ modifiedCount: 1 }));
  await service.cancelCheckout({ _id: row.tenant }, { _id: row.apiKey }, row._id);
  assert.equal(released, 1);
  Checkout.findOne = () => query({ ...row, state: 'cancelled' });
  await service.cancelCheckout({ _id: row.tenant }, { _id: row.apiKey }, row._id);
  assert.equal(released, 1);
});
