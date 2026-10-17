const test = require('node:test');
const assert = require('node:assert/strict');
const Journal = require('../models/JournalEntry');
const Payment = require('../models/CustomerPayment');
const Order = require('../models/Order');
const Statement = require('../models/CustomerAccountStatement');
const Credit = require('../models/CreditNote');
const query = value => ({ session: () => ({ lean: async () => value }) });
const exists = value => ({ session: async () => value });
const posting = (id, account, amount) => ({ _id: id, lines: [
  { account, debit: amount, credit: 0 },
  { account: account === '1300' ? '4000' : '1300', debit: 0, credit: amount },
] });

test('invoice aging follows Lagos calendar days at the 15/16-day boundary', () => {
  const { summarizeSavedInvoices } = require('../services/customerInvoice/summary');
  const summary = summarizeSavedInvoices([
    { state: 'posted', currency: 'NGN', outstanding: 120, dueDate: '2026-09-29T22:00:00Z' },
  ], new Date('2026-10-15T00:00:00+01:00'));
  assert.equal(summary.buckets['16-30'], 120);
  assert.equal(summary.buckets.current, 0);
});

test('missing and invalid due dates do not invent overdue invoice balances', () => {
  const { summarizeSavedInvoices } = require('../services/customerInvoice/summary');
  const summary = summarizeSavedInvoices([
    { state: 'posted', outstanding: 100, date: '2025-01-01' },
    { state: 'posted', outstanding: 20, date: '2025-01-01', dueDate: 'invalid' },
  ], new Date('2026-10-15'));
  assert.equal(summary.totalOutstanding, 120);
  assert.equal(summary.buckets.current, 120);
  assert.equal(summary.buckets['90+'], 0);
});

test('unbalanced account repayment journals cannot reduce a POS invoice balance', async t => {
  const { accountEvidence } = require('../services/customerInvoice/accountEvidence');
  t.mock.method(Statement, 'find', () => query([
    { _id: 'charge', entryType: 'charge', receiptNumber: 'POS-1', amount: 100, occurredAt: '2026-10-10' },
    { _id: 'repayment', entryType: 'payment', reference: 'PAY-1', amount: 100, occurredAt: '2026-10-11' },
  ]));
  t.mock.method(Payment, 'findOne', () => query({ _id: 'payment', amount: 100, allocations: [] }));
  t.mock.method(Journal, 'findOne', () => query({ _id: 'journal', lines: [
    { account: '1000', debit: 10, credit: 0 }, { account: '1300', debit: 0, credit: 100 },
  ] }));
  t.mock.method(Journal, 'exists', () => exists(null));
  const result = await accountEvidence('tenant', {
    receiptNumber: 'POS-1', paymentDetails: { accountCharge: 100, customer: { customerId: 'customer' } },
  });
  assert.equal(result.outstanding, 100);
  assert.match(result.issue, /reconciliation/);
  assert.deepEqual(result.payments, []);
});

function stubSales(t, { payment, receipt, reversed } = {}) {
  t.mock.method(Journal, 'findOne', filter => query(
    filter.entryType === 'sales_revenue' ? posting('revenue', '1300', 100)
      : posting(filter.refDoc === 'receipt' ? 'receipt-journal' : 'payment-journal', '1000', 100)
  ));
  t.mock.method(Journal, 'exists', filter => exists(filter.refDoc === reversed ? { _id: 'reversal' } : null));
  t.mock.method(Payment, 'find', () => query(payment ? [payment] : []));
  t.mock.method(Order, 'find', () => query(receipt ? [receipt] : []));
  t.mock.method(Order, 'aggregate', async () => [{ accountOutstanding: 0 }]);
  t.mock.method(Credit, 'find', () => query([]));
}

test('reversed linked POS settlements cannot mark a Sales invoice paid', async t => {
  stubSales(t, { receipt: { _id: 'receipt', totalAmount: 100 }, reversed: 'receipt-journal' });
  const result = await require('../services/customerInvoice/reconcile').reconcile('aaaaaaaaaaaaaaaaaaaaaaaa', 'sales', {
    _id: 'sales', amountPaid: 100,
  }, 100);
  assert.equal(result.amountPaid, 0);
  assert.equal(result.outstanding, 100);
  assert.match(result.issue, /reversed/i);
});

test('overallocated payment evidence cannot overstate an invoice settlement', async t => {
  stubSales(t, { payment: { _id: 'payment', amount: 100, allocations: [
    { salesOrder: 'sales', amount: 70 }, { salesOrder: 'other', amount: 60 },
  ] } });
  const result = await require('../services/customerInvoice/reconcile').reconcile('tenant', 'sales', {
    _id: 'sales', amountPaid: 70,
  }, 100);
  assert.equal(result.amountPaid, 0);
  assert.equal(result.outstanding, 100);
  assert.match(result.issue, /allocation/i);
});

test('overallocated credit notes cannot reduce an invoice balance', async t => {
  const { creditEvidence } = require('../services/customerInvoice/creditEvidence');
  t.mock.method(Credit, 'find', () => query([{
    _id: 'credit', amount: 100, taxAmount: 0, salesOrder: 'sales', allocations: [
      { salesOrder: 'sales', amount: 70 }, { salesOrder: 'other', amount: 60 },
    ],
  }]));
  t.mock.method(Journal, 'findOne', () => query({ _id: 'credit-journal', lines: [
    { account: '4000', debit: 100, credit: 0 }, { account: '1300', debit: 0, credit: 100 },
  ] }));
  t.mock.method(Journal, 'exists', () => exists(null));
  const result = await creditEvidence('tenant', { _id: 'sales' });
  assert.equal(result.creditedAmount, 0);
  assert.match(result.issue, /allocation/i);
});
