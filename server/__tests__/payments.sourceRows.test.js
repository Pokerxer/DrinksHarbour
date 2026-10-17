const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceRow, sourceSummary } = require('../services/accountingPayment/sourceRows');
const source = { _id: 'sale', soNumber: 'SO-1', total: 100, currency: 'NGN', customerSnapshot: { name: 'Ada' }, paymentMethod: 'cash' };
const entry = { _id: 'journal', refDoc: 'sale', refDocType: 'SalesOrder', entryType: 'sales_revenue', date: '2026-10-14', lines: [{ account: '1000', debit: 60, credit: 0 }, { account: '1300', debit: 40, credit: 0 }, { account: '4000', debit: 0, credit: 100 }] };
test('source receipts use posted tender only, excluding receivable account charge', () => {
 const row = sourceRow(entry, source);
 assert.equal(row.amount, 60); assert.equal(row.source, 'sales'); assert.equal(row.readOnly, true);
 assert.equal(row._id, 'source:journal'); assert.equal(row.allocations.length, 0);
 assert.equal(sourceRow({ ...entry, lines: [{ account: '1300', debit: 100 }, { account: '4000', credit: 100 }] }, source), null);
});
test('unbalanced, negative or mismatching source postings never create receipt money', () => {
 assert.equal(sourceRow({ ...entry, lines: [{ account: '1000', debit: 100 }, { account: '4000', credit: 99 }] }, source), null);
 assert.equal(sourceRow({ ...entry, lines: [{ account: '1000', debit: -10 }, { account: '4000', credit: -10 }] }, source), null);
 assert.equal(sourceRow(entry, { ...source, total: 999 }), null);
});
test('source refunds and reversals remain separate from accounting unallocated cash', () => {
 const invoice = { _id: 'invoice', number: 'INV-1' };
 const row = sourceRow(entry, source, { invoice, refund: 20 });
 assert.equal(row.refundedAmount, 20); assert.equal(row.allocations.length, 0);
 assert.equal(row.invoice.href, '/accounting/invoices/invoice');
 const totals = sourceSummary([row, { ...row, _id: 'reversed', status: 'cancelled' }]);
 assert.equal(totals.activeAmount, 60); assert.equal(totals.refundedAmount, 20);
 assert.equal(totals.unallocated, 0); assert.equal(totals.cancelledAmount, 60);
});
