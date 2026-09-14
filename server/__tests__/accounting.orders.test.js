const test = require('node:test');
const assert = require('node:assert/strict');
const { orderPostings } = require('../services/accounting.orders');
const { isBalanced } = require('../services/accounting.helpers');
const order = { _id: 'order', tenant: 'tenant', source: 'pos', totalAmount: 110, tipAmount: 10, paymentMethod: 'card', items: [{ tenant: 'tenant', quantity: 2, vendorPriceAtPurchase: 20, itemSubtotal: 100 }] };
test('POS separates bank tender, revenue, tips and COGS', () => {
  const entries = orderPostings(order);
  assert.ok(entries.every(e => isBalanced(e.lines)));
  const sale = entries.find(e => e.entryType === 'sales_revenue');
  assert.ok(sale.lines.some(l => l.account === '1100' && l.debit === 110));
  assert.ok(sale.lines.some(l => l.account === '4000' && l.credit === 100));
  assert.ok(sale.lines.some(l => l.account === '2300' && l.credit === 10));
  assert.equal(entries.find(e => e.entryType === 'cogs').lines[0].debit, 40);
});
test('linked POS settlement clears receivables instead of posting sales revenue twice', () => {
  const entries = orderPostings({ ...order, linkedSalesOrder: 'so' });
  assert.ok(entries[0].lines.some(l => l.account === '1300' && l.credit === 100));
  assert.ok(!entries[0].lines.some(l => l.account === '4000'));
});
test('marketplace snapshots stay isolated per tenant and exclude platform-owned shipping', () => {
  const entries = orderPostings({ ...order, source: 'web', tenant: null, tipAmount: 0,
    items: [{ tenant: 'a', itemSubtotal: 100, tenantRevenueShare: 87, platformCommission: 13 }, { tenant: 'b', itemSubtotal: 50, tenantRevenueShare: 45, platformCommission: 5 }] });
  assert.equal(entries.length, 2);
  assert.ok(entries.every(e => isBalanced(e.lines)));
  assert.equal(entries[0].tenantId, 'a');
  assert.ok(entries[0].lines.some(l => l.account === '1300' && l.debit === 87));
});

test('unconverted POS quotations are flagged for review without posting revenue', async (t) => {
  const SalesOrder = require('../models/SalesOrder');
  const journal = require('../services/journalEntry.service');
  t.mock.method(require('../services/chartOfAccounts.service'), 'ensureDefaultCOA', async () => {});
  t.mock.method(SalesOrder, 'findOne', async () => ({ docType: 'quotation' }));
  const post = t.mock.method(journal, 'postJournalEntry', async () => {});
  t.mock.method(console, 'error', () => {});
  let update;
  const receipt = { ...order, paymentStatus: 'paid', linkedSalesOrder: 'quote', constructor: { updateOne: async (_query, value) => { update = value.$set; } } };
  await require('../services/accounting.orders').captureOrderAccounting(receipt);
  assert.equal(post.mock.callCount(), 0);
  assert.equal(update.accountingStatus, 'needs_review');
  assert.match(update.accountingIssue, /converted/);
});

test('marketplace refunds without tenant allocation stay visibly pending review', async (t) => {
  t.mock.method(require('../services/chartOfAccounts.service'), 'ensureDefaultCOA', async () => {});
  t.mock.method(require('../services/journalEntry.service'), 'postJournalEntry', async () => {});
  t.mock.method(console, 'error', () => {});
  let update;
  const receipt = { ...order, source: 'web', paymentStatus: 'refunded', items: [{ tenant: 'tenant', tenantRevenueShare: 87, platformCommission: 13 }], constructor: { updateOne: async (_query, value) => { update = value.$set; } } };
  await require('../services/accounting.orders').captureOrderAccounting(receipt);
  assert.equal(update.accountingStatus, 'needs_review');
  assert.match(update.accountingIssue, /settlement breakdown/);
});
