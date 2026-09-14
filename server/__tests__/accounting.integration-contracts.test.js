const test = require('node:test');
const assert = require('node:assert/strict');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const journal = require('../services/journalEntry.service');

test('manual journal entries never search by an absent business document', async (t) => {
  t.mock.method(Account, 'find', () => ({ lean: async () => [{ _id: 'cash', code: '1000', isActive: true }, { _id: 'sales', code: '4000', isActive: true }] }));
  const lookup = t.mock.method(JournalEntry, 'findOne', async () => null);
  t.mock.method(JournalEntry, 'create', async data => data);
  await journal.postJournalEntry({ tenantId: 'tenant', lines: [{ account: '1000', debit: 10 }, { account: '4000', credit: 10 }], source: 'manual' });
  assert.equal(lookup.mock.callCount(), 0);
});

test('supplying accountId cannot bypass tenant account validation', async (t) => {
  t.mock.method(Account, 'find', () => ({ lean: async () => [] }));
  await assert.rejects(journal.resolveAccounts('tenant', [{ account: '1000', accountId: 'foreign', debit: 10 }]), /Unknown account/);
});

test('AR/AP pagination envelopes work without a global request variable', async (t) => {
  const svc = require('../services/arAp.service');
  t.mock.method(svc, 'listOpenDocs', async () => ({ data: [], total: 0, page: 1, pages: 1 }));
  const controller = require('../controllers/arAp.controller');
  let body;
  let error;
  await controller.listInvoices({ tenant: { _id: 'tenant' }, query: {} }, { json: value => { body = value; } }, err => { error = err; });
  assert.equal(error, undefined);
  assert.equal(body.pagination.limit, 50);
});

test('balance sheet includes owner capital as well as retained earnings', () => {
  const { buildBalanceSheet } = require('../services/accounting.helpers');
  const result = buildBalanceSheet([{ lines: [{ account: '1000', debit: 100, credit: 0 }, { account: '3000', debit: 0, credit: 100 }] }], null, 0);
  assert.equal(result.equity.total, 100);
  assert.equal(result.balanced, true);
});

test('batch creation rejects a partially eligible selection instead of silently dropping payments', async (t) => {
  const Payment = require('../models/CustomerPayment');
  t.mock.method(require('mongoose').connection, 'transaction', fn => fn({}));
  t.mock.method(Payment, 'find', () => ({ session: async () => [{ _id: 'a', amount: 10 }] }));
  await assert.rejects(require('../services/batchPayment.service').createBatch({ tenantId: 'tenant', direction: 'customer', paymentIds: ['a', 'b'] }), /eligible/i);
});

test('profit without inventory costs remains revenue less operating expense', () => {
  const { buildProfitLoss } = require('../services/accounting.helpers');
  const pl = buildProfitLoss([{ lines: [{ account: '4000', credit: 100 }, { account: '6000', debit: 20 }] }]);
  assert.equal(pl.grossProfit, 100);
  assert.equal(pl.netProfit, 80);
});

test('a net COGS refund stays negative and increases profit', () => {
  const { buildProfitLoss } = require('../services/accounting.helpers');
  const pl = buildProfitLoss([{ lines: [{ account: '5000', credit: 20 }] }]);
  assert.equal(pl.cogs.total, -20);
  assert.equal(pl.netProfit, 20);
});
