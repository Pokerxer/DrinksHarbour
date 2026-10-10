// __tests__/arAp.tabFoldIn.test.js
//
// Tab debt is not a SalesOrder, so the AR reads would show a customer who owes
// money on their account as owing nothing — while the Receivables control
// account carries the balance. That gap is silent: every AR screen returns a
// confident, wrong number, and it surfaces later as an unexplained difference
// between the trial balance and the customer directory.
//
// These tests pin the fold-in, including the cases that are easy to get wrong:
// a customer with BOTH an invoice and a tab, and a customer with ONLY a tab who
// would otherwise not appear at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const POSCustomer = require('../models/POSCustomer');
const Statement = require('../models/CustomerAccountStatement');
const customerAccount = require('../services/customerAccount.service');

const TENANT = new mongoose.Types.ObjectId();
const INVOICED = new mongoose.Types.ObjectId();
const TAB_ONLY = new mongoose.Types.ObjectId();

const arAp = () => require('../services/arAp.service');

function stubOrders(t, orders) {
  t.mock.method(SalesOrder, 'find', () => ({ select: () => ({ lean: () => Promise.resolve(orders) }) }));
}

function stubCustomerNames(t, names) {
  t.mock.method(POSCustomer, 'find', () => ({
    select: () => ({ lean: () => Promise.resolve(names.map((n, i) => ({ _id: i, ...n }))) }),
  }));
}

// ── tabBalances: every customer in the tenant carrying a tab ─────────────────

test('tab balances cover the whole tenant and skip voided entries', async (t) => {
  let pipeline;
  t.mock.method(Statement, 'aggregate', (p) => { pipeline = p; return Promise.resolve([]); });
  await customerAccount.tabBalances(TENANT);
  const [match] = pipeline;
  assert.equal(String(match.$match.tenant), String(TENANT), 'another tenant must never appear here');
  assert.equal(match.$match.voided, false);
  assert.ok(!match.$match.customer, 'it must not be scoped to one customer — this is the directory-wide read');
});

test('a customer who settled up exactly is not reported as carrying a tab', async (t) => {
  // Charges 5,000 and payments 5,000 leave nothing owed. Reporting a zero row
  // would put a customer with no debt into the receivables list.
  t.mock.method(Statement, 'aggregate', () => Promise.resolve([{ _id: INVOICED, balance: 0 }]));
  const rows = await customerAccount.tabBalances(TENANT);
  assert.equal(rows.length, 0);
});

test('a negative tab, which the service refuses to create, is not reported as debt', async (t) => {
  t.mock.method(Statement, 'aggregate', () => Promise.resolve([{ _id: INVOICED, balance: -500 }]));
  assert.equal((await customerAccount.tabBalances(TENANT)).length, 0);
});

// ── customerBalances: the directory ──────────────────────────────────────────

test('a customer with only a tab still appears as owing money', async (t) => {
  stubOrders(t, []);
  stubCustomerNames(t, []);
  t.mock.method(customerAccount, 'tabBalances', () => Promise.resolve([{ customerId: TAB_ONLY, balance: 3000 }]));

  const rows = await arAp().customerBalances(TENANT);
  const row = rows.find(r => String(r.customerId) === String(TAB_ONLY));
  assert.ok(row, 'a tab customer with no invoice is still a receivable');
  assert.equal(row.outstanding, 3000);
  assert.equal(row.openInvoices, 0, 'a tab charge is not an invoice, and must not be counted as one');
});

test('tab debt adds to a customer who also has open invoices', async (t) => {
  stubOrders(t, [{ customer: INVOICED, total: 20000, amountPaid: 5000, creditedAmount: 0 }]);
  stubCustomerNames(t, []);
  t.mock.method(customerAccount, 'tabBalances', () => Promise.resolve([{ customerId: INVOICED, balance: 1500 }]));

  const row = (await arAp().customerBalances(TENANT)).find(r => String(r.customerId) === String(INVOICED));
  assert.equal(row.outstanding, 16500, '5,000 outstanding plus 1,500 on the tab');
  assert.equal(row.openInvoices, 1, 'the invoice count is unaffected by tab activity');
});

test('a customer with neither an invoice nor a tab is absent', async (t) => {
  stubOrders(t, [{ customer: INVOICED, total: 20000, amountPaid: 20000, creditedAmount: 0 }]);
  stubCustomerNames(t, []);
  t.mock.method(customerAccount, 'tabBalances', () => Promise.resolve([]));
  const rows = await arAp().customerBalances(TENANT);
  assert.equal(rows.length, 0);
});

// ── summary: the AR dashboard ───────────────────────────────────────────────

test('the AR summary counts on-account debt as outstanding', async (t) => {
  t.mock.method(SalesOrder, 'find', () => ({
    select: () => ({ lean: () => Promise.resolve([{ total: 20000, amountPaid: 0, creditedAmount: 0, createdAt: new Date() }]) }),
  }));
  t.mock.method(customerAccount, 'tabBalances', () => Promise.resolve([{ customerId: TAB_ONLY, balance: 7500 }]));

  const result = await arAp().summary(TENANT, 'ar');
  assert.equal(result.totalOutstanding, 27500, '20,000 of invoices plus 7,500 on account');
  assert.equal(result.onAccount, 7500, 'reported separately so the mix is visible');
  assert.equal(result.buckets.current, 27500, 'a tab has no due date, so it is not yet overdue');
  assert.equal(result.count, 1, 'a tab charge is not an invoice and does not inflate the count');
});

test('the AP summary is untouched by customer tabs', async (t) => {
  const VendorBill = require('../models/VendorBill');
  t.mock.method(VendorBill, 'find', () => ({ select: () => ({ lean: () => Promise.resolve([]) }) }));
  let called = false;
  t.mock.method(customerAccount, 'tabBalances', () => { called = true; return Promise.resolve([]); });
  const result = await arAp().summary(TENANT, 'ap');
  assert.equal(called, false, 'payables are not affected by what customers owe');
  assert.equal(result.onAccount, undefined);
});
