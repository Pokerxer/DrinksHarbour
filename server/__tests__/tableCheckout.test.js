'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const payments = require('../services/payment.service');
const { tableRevenue, startTableCheckout, settleTablePayment } = require('../services/tableCheckout.service');
test('table commission uses 9% with kobo precision and balanced revenue', () => {
  for (const amount of [100, 1234.56, 0.01]) {
    const value = tableRevenue(amount);
    assert.equal(Math.round((value.commission + value.tenantShare) * 100), Math.round(amount * 100));
  }
  assert.deepEqual(tableRevenue(1000), { subtotal: 1000, commission: 90, tenantShare: 910 });
});
test('checkout scopes booking to authenticated venue and refuses unchecked-in guests', async t => {
  t.mock.method(Booking, 'findOne', async filter => {
    assert.deepEqual(filter, { _id: 'booking', tenant: 'own' });
    return { status: 'pending' };
  });
  await assert.rejects(startTableCheckout({ _id: 'own' }, 'actor', 'booking', { tenant: 'other' }), /Check the guest in/);
});
test('unverified, underpaid, foreign-currency and wrong-reference payments cannot settle a bill', async t => {
  const order = { _id: 'order', tenant: 'own', paymentStatus: 'pending', totalAmount: 1000, paymentReference: 'expected' };
  t.mock.method(Order, 'findOneAndUpdate', () => assert.fail('must not mark paid'));
  for (const data of [ { amount: 1, currency: 'NGN', reference: 'expected' },
    { amount: 1000, currency: 'USD', reference: 'expected' }, { amount: 1000, currency: 'NGN', reference: 'other' } ]) {
    t.mock.method(payments, 'verifyGatewayTransaction', async () => ({ success: true, status: 'paid', data }));
    await assert.rejects(settleTablePayment(order), /does not match/);
  }
  await assert.rejects(settleTablePayment({ ...order, paymentStatus: 'refunded' }), /cannot be settled/);
});
test('verified settlement posts a balanced tenant journal and replay does not re-confirm payment', async t => {
  const journal = require('../services/journalEntry.service');
  const order = { _id: 'order', tenant: 'own', paymentStatus: 'pending', totalAmount: 1000,
    paymentReference: 'expected', platformCommissionTotal: 90 };
  let confirmations = 0;
  let posts = 0;
  let existing = null;
  t.mock.method(payments, 'verifyGatewayTransaction', async () => ({ success: true, status: 'paid',
    data: { amount: 1000, currency: 'NGN', reference: 'expected', paidAt: '2026-09-07' } }));
  t.mock.method(Order, 'findOneAndUpdate', async (query, update) => {
    assert.equal(query.tenant, 'own'); confirmations++; return { ...order, ...update.$set };
  });
  t.mock.method(Order, 'updateOne', async query => { assert.equal(query.tenant, 'own'); return { matchedCount: 1 }; });
  t.mock.method(journal, 'findEntry', async () => existing);
  t.mock.method(journal, 'postJournalEntry', async entry => {
    posts++; existing = { _id: 'entry' };
    assert.equal(entry.tenantId, 'own');
    assert.equal(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0);
    assert.equal(entry.lines[0].debit, 910);
    return existing;
  });
  const paid = await settleTablePayment(order);
  await settleTablePayment(paid);
  assert.equal(confirmations, 1);
  assert.equal(posts, 1);
});

test('a concurrent paid callback preserves completed fulfillment', async t => {
  const journal = require('../services/journalEntry.service');
  const current = { _id: 'bill', tenant: 'own', paymentStatus: 'paid', status: 'delivered' };
  t.mock.method(payments, 'verifyGatewayTransaction', async () => ({ success: true, status: 'paid',
    data: { reference: 'ref', currency: 'NGN', amount: 100 } }));
  t.mock.method(Order, 'findOneAndUpdate', async filter => {
    assert.equal(filter.paymentStatus, 'pending'); return null;
  });
  t.mock.method(Order, 'findOne', async () => current);
  t.mock.method(Order, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(journal, 'findEntry', async () => ({ _id: 'journal' }));
  const result = await settleTablePayment({ ...current, paymentStatus: 'pending', status: 'pending',
    paymentReference: 'ref', totalAmount: 100 });
  assert.equal(result.status, 'delivered');
});

test('table completion atomically consumes reservations and a retry does not consume twice', async t => {
  const inventory = require('../services/inventory.service');
  const { completeTableBooking } = require('../services/tableCheckout.service');
  const session = { withTransaction: async fn => fn(), endSession: async () => {} };
  const booking = { status: 'checked_in', save: async () => {}, toObject() { return { status: this.status }; } };
  const bill = { _id: 'bill', paymentStatus: 'paid', tableAccountingStatus: 'posted',
    status: 'confirmed', items: [{ subproduct: 'product', quantity: 2 }], save: async () => {} };
  t.mock.method(Order, 'startSession', async () => session);
  t.mock.method(Booking, 'findOne', filter => {
    assert.equal(filter.tenant, 'own'); return { session: async () => booking };
  });
  t.mock.method(Order, 'findOne', filter => {
    assert.equal(filter.tenant, 'own'); return { session: async () => bill };
  });
  let shipments = 0;
  t.mock.method(inventory, 'commitShipment', async (items, id, actor, options) => {
    assert.equal(options.session, session); shipments++;
  });
  assert.equal((await completeTableBooking('own', 'booking')).status, 'completed');
  await completeTableBooking('own', 'booking');
  assert.equal(bill.status, 'delivered');
  assert.equal(shipments, 1);
});
