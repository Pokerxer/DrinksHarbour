const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const journal = require('../services/journalEntry.service');
function setup(t, doc) {
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', fn => fn(session));
  t.mock.method(require('../services/chartOfAccounts.service'), 'ensureDefaultCOA', async () => {});
  let filter;
  t.mock.method(SalesOrder, 'findOne', query => { filter = query; return { session: async () => doc }; });
  const post = t.mock.method(journal, 'postJournalEntry', async args => { assert.equal(args.session, session); return { _id: 'journal' }; });
  return { session, post, filter: () => filter };
}
test('issuing an invoice posts unpaid receivables in the same transaction', async t => {
  const doc = { _id: 'draft', tenant: 'tenant', docType: 'quotation', quoteStatus: 'draft', total: 107.5, taxTotal: 7.5, currency: 'NGN', items: [{ lineType: 'product', subproduct: 'product', quantity: 1 }], save: async function(options) { assert.equal(options.session, state.session); } };
  const state = setup(t, doc);
  await require('../services/accountingInvoice.service').issueInvoice({ tenantId: 'tenant', id: 'draft', dueDate: '2026-10-01' });
  assert.equal(doc.docType, 'order');
  assert.equal(doc.orderStatus, 'confirmed');
  assert.equal(doc.amountPaid, 0);
  assert.equal(doc.paymentStatus, 'unpaid');
  assert.equal(state.filter().tenant, 'tenant');
  assert.equal(state.post.mock.calls[0].arguments[0].lines[0].account, '1300');
});
test('invoice issue rejects a source outside the tenant', async t => {
  const state = setup(t, null);
  await assert.rejects(require('../services/accountingInvoice.service').issueInvoice({ tenantId: 'tenant', id: 'foreign' }), /not found/);
  assert.equal(state.post.mock.callCount(), 0);
});
test('invoice issue retry does not change a confirmed invoice or post twice', async t => {
  const doc = { docType: 'order', orderStatus: 'confirmed', invoiceIssuedAt: new Date() };
  const state = setup(t, doc);
  assert.equal(await require('../services/accountingInvoice.service').issueInvoice({ tenantId: 'tenant', id: 'invoice' }), doc);
  assert.equal(state.post.mock.callCount(), 0);
});

test('invalid invoice dates fail before any transaction starts', async t => {
  const transaction = t.mock.method(mongoose.connection, 'transaction', async () => {});
  await assert.rejects(require('../services/accountingInvoice.service').issueInvoice({ tenantId: 'tenant', id: 'draft', dueDate: '2026-02-30' }), /Invalid date/);
  assert.equal(transaction.mock.callCount(), 0);
});

test('a draft with existing payments cannot become a new unpaid invoice', async t => {
  const state = setup(t, { docType: 'order', orderStatus: 'draft', total: 100, amountPaid: 25, currency: 'NGN' });
  await assert.rejects(require('../services/accountingInvoice.service').issueInvoice({ tenantId: 'tenant', id: 'draft' }), /existing payments/);
  assert.equal(state.post.mock.callCount(), 0);
});
