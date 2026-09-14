const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePayment, paymentLines } = require('../services/accountingPayment.helpers');
test('reject invalid amounts, duplicate allocations, and excessive allocations', () => {
  for (const amount of [0, -1, Infinity, NaN]) assert.throws(() => validatePayment({ amount }, 'customer'), /amount/i);
  assert.throws(() => validatePayment({ amount: 10, allocations: [{ salesOrder: 'a', amount: 3 }, { salesOrder: 'a', amount: 3 }] }, 'customer'), /once/i);
  assert.throws(() => validatePayment({ amount: 10, allocations: [{ salesOrder: 'a', amount: 11 }] }, 'customer'), /exceed/i);
});
test('cash and bank receipts and payouts balance against the correct control account', () => {
  assert.deepEqual(paymentLines({ amount: 12, method: 'bank_transfer' }, 'customer').map(l => [l.account, l.debit, l.credit]), [['1100', 12, 0], ['1300', 0, 12]]);
  assert.deepEqual(paymentLines({ amount: 12, method: 'cash' }, 'vendor').map(l => [l.account, l.debit, l.credit]), [['2000', 12, 0], ['1000', 0, 12]]);
});

test('accounting payment refuses wallet registration before writing anything', async () => {
  const svc = require('../services/accountingPayment.service');
  await assert.rejects(svc.createPayment({ tenantId: 'tenant', direction: 'customer', data: { amount: 10, method: 'wallet' } }), /POS or the sales order/);
});

test('a cross-tenant allocation aborts without a payment or journal write', async (t) => {
  const mongoose = require('mongoose');
  const coa = require('../services/chartOfAccounts.service');
  const SalesOrder = require('../models/SalesOrder');
  const Payment = require('../models/CustomerPayment');
  const journal = require('../services/journalEntry.service');
  const session = {};
  t.mock.method(coa, 'ensureDefaultCOA', async () => {});
  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  let filter;
  t.mock.method(SalesOrder, 'findOne', query => { filter = query; return { session: async supplied => { assert.equal(supplied, session); return null; } }; });
  const create = t.mock.method(Payment, 'create', async () => { throw new Error('must not create'); });
  const post = t.mock.method(journal, 'postJournalEntry', async () => { throw new Error('must not post'); });
  delete require.cache[require.resolve('../services/accountingPayment.service')];
  const svc = require('../services/accountingPayment.service');
  await assert.rejects(svc.createPayment({ tenantId: 'own-tenant', direction: 'customer', data: { amount: 10, allocations: [{ salesOrder: '507f1f77bcf86cd799439011', amount: 10 }] } }), /not available in this tenant/);
  assert.equal(filter.tenant, 'own-tenant');
  assert.equal(create.mock.callCount(), 0);
  assert.equal(post.mock.callCount(), 0);
  delete require.cache[require.resolve('../services/accountingPayment.service')];
});

test('payment updates the invoice and posts bank receipt inside the same transaction', async (t) => {
  const mongoose = require('mongoose');
  const coa = require('../services/chartOfAccounts.service');
  const SalesOrder = require('../models/SalesOrder');
  const Payment = require('../models/CustomerPayment');
  const journal = require('../services/journalEntry.service');
  const session = {};
  t.mock.method(coa, 'ensureDefaultCOA', async () => {});
  t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
  let saved = false;
  const doc = { total: 100, amountPaid: 20, creditedAmount: 10, currency: 'NGN', save: async options => { assert.equal(options.session, session); saved = true; } };
  t.mock.method(SalesOrder, 'findOne', () => ({ session: async () => doc }));
  t.mock.method(Payment, 'create', async (rows, options) => { assert.equal(options.session, session); return [{ ...rows[0], _id: 'payment' }]; });
  const post = t.mock.method(journal, 'postJournalEntry', async data => { assert.equal(data.session, session); assert.equal(data.tenantId, 'own-tenant'); return data; });
  delete require.cache[require.resolve('../services/accountingPayment.service')];
  await require('../services/accountingPayment.service').createPayment({ tenantId: 'own-tenant', direction: 'customer', data: { customerName: 'Ada', amount: 30, method: 'bank_transfer', allocations: [{ salesOrder: '507f1f77bcf86cd799439011', amount: 30 }] } });
  assert.equal(doc.amountPaid, 50);
  assert.equal(doc.paymentStatus, 'partial');
  assert.equal(doc.creditedAmount, 10);
  assert.ok(saved);
  assert.equal(post.mock.calls[0].arguments[0].lines[0].account, '1100');
  delete require.cache[require.resolve('../services/accountingPayment.service')];
});

test('cancelling a receipt reverses its journal and restores the invoice in one transaction', async (t) => {
  const mongoose = require('mongoose');
  const Payment = require('../models/CustomerPayment');
  const SalesOrder = require('../models/SalesOrder');
  const JournalEntry = require('../models/JournalEntry');
  const journal = require('../services/journalEntry.service');
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', fn => fn(session));
  const save = async options => assert.equal(options.session, session);
  const payment = { _id: 'payment', status: 'active', batch: null, allocations: [{ salesOrder: '507f1f77bcf86cd799439011', amount: 30 }], save };
  const invoice = { total: 100, amountPaid: 30, currency: 'NGN', save };
  t.mock.method(Payment, 'findOne', () => ({ session: async () => payment }));
  t.mock.method(SalesOrder, 'findOne', () => ({ session: async () => invoice }));
  t.mock.method(JournalEntry, 'findOne', () => ({ session: async () => ({ _id: 'entry' }) }));
  const reverse = t.mock.method(journal, 'reverseEntry', async args => assert.equal(args.session, session));
  delete require.cache[require.resolve('../services/accountingPayment.service')];
  await require('../services/accountingPayment.service').cancelPayment({ tenantId: 'tenant', direction: 'customer', id: 'payment' });
  assert.equal(invoice.amountPaid, 0);
  assert.equal(invoice.paymentStatus, 'unpaid');
  assert.equal(payment.status, 'cancelled');
  assert.equal(reverse.mock.callCount(), 1);
  delete require.cache[require.resolve('../services/accountingPayment.service')];
});
