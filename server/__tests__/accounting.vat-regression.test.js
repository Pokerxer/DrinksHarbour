const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const TaxRecord = require('../models/TaxRecord');
const Tax = require('../models/Tax');
const tax = require('../services/tax.service');
const { orderPostings, captureOrderAccounting } = require('../services/accounting.orders');
const { buildProfitLoss, isBalanced } = require('../services/accounting.helpers');
const id = () => new mongoose.Types.ObjectId();
const receipt = (overrides = {}) => ({
  _id: id(), tenant: id(), receiptNumber: 'POS-VAT-1', source: 'pos',
  paymentStatus: 'paid', paymentMethod: 'cash', totalAmount: 1087,
  taxAmount: 75, tipAmount: 10, roundingAmount: 2, paidAt: new Date('2026-08-10T10:00:00Z'),
  items: [{ quantity: 2, itemSubtotal: 1000, taxRate: 7.5, taxAmount: 75, vendorPriceAtPurchase: 200 }],
  ...overrides,
});

test('TaxRecord accepts a POS receipt source', async () => {
  await new TaxRecord({ tenant: id(), sourceId: id(), sourceType: 'pos', taxName: 'VAT', taxRate: 7.5, direction: 'collected', taxableBase: 1000, taxAmount: 75 }).validate();
});

test('POS tax groups keep actual rounded tax charged per line', () => {
  const groups = tax._buildRecordGroups({ sourceType: 'pos', taxes: [], doc: receipt({
    taxAmount: 2, items: [{ itemSubtotal: 10, taxRate: 7.5, taxAmount: 1 }, { itemSubtotal: 10, taxRate: 7.5, taxAmount: 1 }],
  }) });
  assert.equal(groups[0].taxAmount, 2);
});

test('strict tax capture surfaces storage failures', async t => {
  t.mock.method(Tax, 'find', () => ({ lean: async () => { throw new Error('tax storage unavailable'); } }));
  t.mock.method(console, 'error', () => {});
  await assert.rejects(tax.captureDocumentTax({ sourceType: 'pos', doc: receipt(), strict: true }), /tax storage unavailable/);
});

test('POS cash rounding is separate from merchandise revenue and clears no extra receivable', () => {
  for (const linkedSalesOrder of [undefined, id()]) {
    const entries = orderPostings(receipt({ linkedSalesOrder }));
    assert.ok(entries.every(entry => isBalanced(entry.lines)));
    const sale = entries[0];
    assert.equal(sale.lines.find(line => line.account === (linkedSalesOrder ? '1300' : '4000')).credit, linkedSalesOrder ? 1075 : 1000);
    assert.equal(sale.lines.find(line => line.account === '4100').credit, 2);
  }
});

function accountingMocks(t) {
  t.mock.method(require('../services/chartOfAccounts.service'), 'ensureDefaultCOA', async () => {});
  const journal = require('../services/journalEntry.service');
  t.mock.method(journal, 'postJournalEntry', async () => ({}));
  t.mock.method(journal, 'findEntry', async () => ({ _id: id() }));
  t.mock.method(console, 'error', () => {});
  let update;
  const doc = receipt({ constructor: { updateOne: async (_, value) => { update = value.$set; } } });
  return { doc, status: () => update };
}

test('tax capture failure leaves the order visibly awaiting accounting review', async t => {
  const { doc, status } = accountingMocks(t);
  t.mock.method(tax, 'captureDocumentTax', async () => { throw new Error('VAT write failed'); });
  await captureOrderAccounting(doc);
  assert.equal(status().accountingStatus, 'needs_review');
  assert.match(status().accountingIssue, /VAT write failed/);
});

test('an unallocated partial refund cannot erase all sale VAT', async t => {
  const { doc, status } = accountingMocks(t);
  doc.paymentStatus = 'partially_refunded';
  doc.refunds = [{ _id: id(), totalRefunded: 100 }];
  t.mock.method(tax, 'captureDocumentTax', async () => []);
  const reverse = t.mock.method(tax, 'reverseDocumentTax', async () => {});
  await captureOrderAccounting(doc);
  assert.equal(status().accountingStatus, 'needs_review');
  assert.equal(reverse.mock.callCount(), 0);
});

test('linked POS receipt captures tax on its sales invoice only', async t => {
  const { doc } = accountingMocks(t);
  doc.linkedSalesOrder = id();
  const so = { _id: doc.linkedSalesOrder, tenant: doc.tenant, docType: 'order', taxTotal: 75 };
  t.mock.method(require('../models/SalesOrder'), 'findOne', async () => so);
  const capture = t.mock.method(tax, 'captureDocumentTax', async () => []);
  await captureOrderAccounting(doc);
  assert.equal(capture.mock.callCount(), 1);
  assert.equal(capture.mock.calls[0].arguments[0].sourceType, 'sales_order');
  assert.equal(capture.mock.calls[0].arguments[0].doc, so);
});

test('P&L distinguishes sales reversals, other income and VAT journal/ledger mismatch', () => {
  const lines = [
    { account: '4000', credit: 1000 }, { account: '4000', debit: 200 },
    { account: '4100', credit: 2 }, { account: '5000', debit: 400 },
    { account: '5000', credit: 80 }, { account: '6000', debit: 50 },
    { account: '2100', credit: 75 }, { account: '2100', debit: 15 },
  ];
  const pl = buildProfitLoss([{ lines }], { collected: 0, paid: 0 });
  assert.equal(pl.sales.gross, 1000);
  assert.equal(pl.sales.reversals, 200);
  assert.equal(pl.sales.net, 800);
  assert.equal(pl.otherIncome, 2);
  assert.equal(pl.grossProfit, 480);
  assert.equal(pl.netProfit, 432);
  assert.equal(pl.tax.collected, 60);
  assert.equal(pl.tax.ledgerCollected, 0);
  assert.equal(pl.tax.reconciled, false);
});

test('reversing a refund restores net sales without inventing a second sale', () => {
  const pl = buildProfitLoss([
    { entryType: 'sales_revenue', refDoc: 'order', lines: [{ account: '4000', credit: 1000 }] },
    { entryType: 'refund', refDoc: 'refund', lines: [{ account: '4000', debit: 200 }] },
    { entryType: 'reversal', refDoc: 'refund-entry', lines: [{ account: '4000', credit: 200 }] },
  ]);
  assert.equal(pl.sales.gross, 1000);
  assert.equal(pl.sales.reversals, 0);
  assert.equal(pl.sales.net, 1000);
  assert.equal(pl.sales.documentCount, 1);
});

test('voiding a linked receipt reopens its receivable without cancelling invoice VAT', async t => {
  const { doc, status } = accountingMocks(t);
  doc.linkedSalesOrder = id();
  doc.isVoided = true;
  t.mock.method(require('../models/SalesOrder'), 'findOne', async () => ({ _id: doc.linkedSalesOrder, tenant: doc.tenant, docType: 'order' }));
  const reverseEntry = t.mock.method(require('../services/journalEntry.service'), 'reverseEntry', async () => {});
  const reverseTax = t.mock.method(tax, 'reverseDocumentTax', async () => {});
  const capture = t.mock.method(tax, 'captureDocumentTax', async () => []);
  await captureOrderAccounting(doc);
  assert.equal(status().accountingStatus, 'posted');
  assert.equal(reverseEntry.mock.callCount(), 2); // Receipt settlement and its COGS only.
  assert.equal(reverseTax.mock.callCount(), 0);
  assert.equal(capture.mock.callCount(), 0);
});
