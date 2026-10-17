const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Statement = require('../models/CustomerAccountStatement');
const SalesOrder = require('../models/SalesOrder');
const VendorBill = require('../models/VendorBill');
const customerAccount = require('../services/customerAccount.service');
const arAp = require('../services/arAp.service');
const uri = process.env.DRINKSHARBOUR_ACCOUNTING_TEST_MONGO_URI;

test('MongoDB computes tenant customer balances and accounting open summaries', { skip: !uri }, async (t) => {
  // Never load .env or run fixtures/cleanup against an application database.
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_accounting_test_[\w]+$/);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const tenant = new mongoose.Types.ObjectId();
  const otherTenant = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  const settled = new mongoose.Types.ObjectId();
  const absent = new mongoose.Types.ObjectId();
  await Statement.collection.insertMany([
    { tenant, customer, entryType: 'charge', amount: 100.25, voided: false },
    { tenant, customer, entryType: 'charge', amount: 0.1, voided: false },
    { tenant, customer, entryType: 'payment', amount: 20.1, voided: false },
    { tenant, customer, entryType: 'credit', amount: 5.25, voided: false },
    { tenant, customer, entryType: 'charge', amount: 999, voided: true },
    { tenant: otherTenant, customer, entryType: 'charge', amount: 999, voided: false },
    { tenant, customer: settled, entryType: 'charge', amount: 10, voided: false },
    { tenant, customer: settled, entryType: 'payment', amount: 10, voided: false },
  ]);
  await SalesOrder.collection.insertMany([
    { tenant, currency: 'NGN', docType: 'order', orderStatus: 'confirmed', paymentStatus: 'partial', total: 200, amountPaid: 50, creditedAmount: 25, createdAt: new Date() },
    { tenant: otherTenant, currency: 'NGN', docType: 'order', orderStatus: 'confirmed', paymentStatus: 'unpaid', total: 999 },
  ]);
  await VendorBill.collection.insertOne({ tenant, currency: 'NGN', status: 'partial', totalAmount: 300, paidAmount: 100, billDate: new Date() });

  await t.test('individual balances exclude voids and other tenants and subtract credits', async () => {
    const balances = await customerAccount.balances(tenant, [customer, settled, absent]);
    assert.equal(balances.get(String(customer)), 75);
    assert.equal(balances.get(String(settled)), 0);
    assert.equal(balances.get(String(absent)), 0);
  });
  await t.test('tab directory returns only positive balances', async () => {
    const tabs = await customerAccount.tabBalances(tenant);
    assert.equal(tabs.length, 1);
    assert.equal(String(tabs[0].customerId), String(customer));
    assert.equal(tabs[0].balance, 75);
  });
  await t.test('receivables include invoice and tab debt without counting tabs as invoices', async () => {
    const result = await arAp.summary(tenant, 'ar');
    assert.equal(result.totalOutstanding, 200);
    assert.equal(result.onAccount, 75);
    assert.equal(result.count, 1);
    assert.equal(result.buckets.current, 200);
  });
  await t.test('payables remain independent of customer tabs', async () => {
    const result = await arAp.summary(tenant, 'ap');
    assert.equal(result.totalOutstanding, 200);
    assert.equal(result.count, 1);
    assert.equal(result.onAccount, undefined);
  });
});
