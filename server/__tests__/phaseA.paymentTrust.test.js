'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const Order = require('../models/Order'); const payments = require('../services/payment.service');
const actor = { _id: '650000000000000000000001', role: 'customer' };
function target(t, overrides = {}) {
 let saves = 0;
 const row = { _id: '650000000000000000000002', user: '650000000000000000000003', items: [],
   status: 'pending', paymentStatus: 'pending', totalAmount: 100, currency: 'NGN', save: async () => { saves++; }, ...overrides };
 t.mock.method(Order, 'findById', async () => row);
 return { row, writes: () => saves };
}
test('a foreign customer cannot attach a claimed payment', async t => {
 const f = target(t);
 await assert.rejects(payments.attachPaymentToOrder(f.row._id, { method: 'wallet', transactionId: 'forged' }, actor), e => e.statusCode === 404);
 assert.equal(f.writes(), 0);
});
test('private payment status requires owner even when id is known', async t => {
 const f = target(t);
 await assert.rejects(payments.getPaymentStatus(f.row._id, actor), e => e.statusCode === 404);
});
test('customer cannot execute provider refunds', async t => {
 const f = target(t, { user: actor._id, paymentIntentId: 'pi_fake', paymentStatus: 'paid' });
 await assert.rejects(payments.createStripeRefund(f.row._id, 100, actor), e => e.statusCode === 403);
 assert.equal(f.writes(), 0);
});
