const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const Customer = require('../models/POSCustomer');
const Invoice = require('../models/CustomerInvoice');
const service = require('../services/creditNote.service');

test('credit availability search is tenant scoped and applied before pagination with complete totals', async (t) => {
  const tenant = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  let filter;
  let pipeline;
  t.mock.method(Customer, 'find', (query) => {
    assert.equal(query.tenant, tenant);
    assert.equal(query.$or[0].firstName.test('Ada['), true);
    return { select: () => ({ lean: async () => [{ _id: customer }] }) };
  });
  t.mock.method(CreditNote, 'find', (query) => {
    filter = query;
    const chain = { sort: () => chain, skip: (n) => { assert.equal(n, 25); return chain; }, limit: () => chain, populate: () => chain, lean: async () => [] };
    return chain;
  });
  t.mock.method(CreditNote, 'countDocuments', async () => 30);
  t.mock.method(CreditNote, 'aggregate', async (query) => {
    pipeline = query;
    return [{ postedTotal: 250, available: 75, draftTotal: 20, count: 30 }];
  });
  t.mock.method(Invoice, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const result = await service.listCreditNotes(tenant, { status: 'partial', search: 'Ada[', page: 2, limit: 25 });
  assert.equal(String(filter.tenant), String(tenant));
  assert.equal(filter.status, 'applied');
  assert.equal(filter.unappliedAmount.$gt, 0.005);
  assert.ok(filter.$expr);
  assert.equal(filter.$or[0].number.test('Ada['), true);
  assert.equal(filter.$or.at(-1).customer.$in[0], customer);
  assert.deepEqual(pipeline[0].$match, filter);
  assert.equal(result.total, 30);
  assert.equal(result.pages, 2);
  assert.equal(result.summary.available, 75);
});

test('invalid credit-note filters fail before database reads', async () => {
  await assert.rejects(service.listCreditNotes(new mongoose.Types.ObjectId(), { status: 'paid' }), /Invalid credit status/);
  await assert.rejects(service.listCreditNotes(new mongoose.Types.ObjectId(), { customer: 'foreign-text' }), /Invalid customer/);
  await assert.rejects(service.listCreditNotes(new mongoose.Types.ObjectId(), { from: '2026-02-30' }), /Invalid date/);
});
