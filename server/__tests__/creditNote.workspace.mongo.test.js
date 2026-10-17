const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.CREDIT_WORKSPACE_TEST_URI;
test('credit workspace filters and totals use the whole tenant ledger and invoice choices include paid Sales only', { skip: !uri }, async (t) => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_credit_workspace_test_\w+$/);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const tenant = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId(), customer = new mongoose.Types.ObjectId(), foreign = new mongoose.Types.ObjectId();
  const Note = require('../models/CreditNote');
  const Invoice = require('../models/CustomerInvoice');
  const Customer = require('../models/POSCustomer');
  await Customer.collection.insertMany([{ _id: customer, tenant, firstName: 'Ada[', lastName: 'Obi' }, { _id: foreign, tenant: other, firstName: 'Ada[' }]);
  const source = new mongoose.Types.ObjectId();
  await Note.collection.insertMany([
    { tenant, customer, salesOrder: source, number: 'CN-1', date: new Date('2026-10-14'), amount: 100, taxAmount: 7.5, status: 'applied', unappliedAmount: 107.5, allocations: [] },
    { tenant, customer, number: 'CN-2', date: new Date('2026-10-13'), amount: 100, taxAmount: 0, status: 'applied', unappliedAmount: 40, allocations: [{ salesOrder: source, amount: 60, appliedAt: new Date() }] },
    { tenant, customer, number: 'CN-3', date: new Date('2026-10-12'), amount: 20, taxAmount: 0, status: 'applied', unappliedAmount: 0, allocations: [] },
    { tenant, customer, date: new Date('2026-10-12'), amount: 50, taxAmount: 0, status: 'draft', unappliedAmount: 0, allocations: [] },
    { tenant, customer, number: 'CN-4', date: new Date('2026-10-12'), amount: 999, taxAmount: 0, status: 'cancelled', unappliedAmount: 0, allocations: [] },
    { tenant: other, customer: foreign, number: 'CN-X', date: new Date('2026-10-14'), amount: 9999, status: 'applied', unappliedAmount: 9999, allocations: [] },
  ]);
  const base = { tenant, state: 'posted', source: 'sales', sourceId: source, number: 'INV-1', date: new Date('2026-10-14'), currency: 'NGN', customer, total: 100, amountPaid: 100, outstanding: 0, reconciliationIssue: '', items: [], paymentStatus: 'paid' };
  const inserted = await Invoice.collection.insertOne({ ...base });
  await Invoice.collection.insertMany([
    { ...base, sourceId: new mongoose.Types.ObjectId(), number: 'INV-X', tenant: other },
    { ...base, source: 'pos', sourceId: new mongoose.Types.ObjectId(), number: 'INV-POS', outstanding: 50 },
    { ...base, sourceId: new mongoose.Types.ObjectId(), number: 'INV-DRAFT', state: 'draft' },
    { ...base, sourceId: new mongoose.Types.ObjectId(), number: 'INV-FOREIGN', customer: foreign },
    { ...base, sourceId: new mongoose.Types.ObjectId(), number: 'INV-USD', currency: 'USD' },
  ]);
  const list = require('../services/creditNote.service').listCreditNotes;
  const all = await list(tenant, { limit: 1 });
  assert.equal(all.total, 5); assert.equal(all.data.length, 1);
  assert.equal(all.summary.postedTotal, 227.5); assert.equal(all.summary.available, 147.5);
  assert.equal(all.summary.appliedTotal, 80); assert.equal(all.summary.draftTotal, 50);
  assert.equal(all.data[0].invoice.id, String(inserted.insertedId));
  assert.equal((await list(tenant, { status: 'partial' })).data[0].number, 'CN-2');
  assert.equal((await list(tenant, { status: 'available' })).total, 1);
  assert.equal((await list(tenant, { status: 'full' })).data[0].number, 'CN-3');
  assert.equal((await list(tenant, { search: 'Ada[' })).total, 5);
  assert.equal((await list(tenant, { from: '2026-10-14', to: '2026-10-14' })).total, 1);
  const choices = await require('../services/customerInvoice/browse').listInvoices(tenant, { scope: 'credit', customer: String(customer) });
  assert.deepEqual(choices.data.map((inv) => inv.number), ['INV-1']);
});
