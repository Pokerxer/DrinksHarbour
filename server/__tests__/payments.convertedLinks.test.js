const test = require('node:test');
const assert = require('node:assert/strict');
const Journal = require('../models/JournalEntry');
const Sales = require('../models/SalesOrder');
const Order = require('../models/Order');
const Invoice = require('../models/CustomerInvoice');
const { readSourceReceipts } = require('../services/accountingPayment/sourceReceipts');
const tenant = 'tenant';
const quotation = { _id: 'quote', docType: 'quotation', convertedTo: 'sale', soNumber: 'QUO-1', total: 100, currency: 'NGN', customerSnapshot: { name: 'Ada' } };
const savedInvoice = { _id: 'invoice', source: 'sales', sourceId: 'sale', number: 'INV-1' };
async function receipts(t, sales, invoices) {
  // Replace only database I/O; exercise the real receipt verification/linking pipeline.
  for (const model of [Journal, Sales, Order, Invoice]) {
    const original = model.find;
    t.after(() => { model.find = original; });
    model.find = (filter) => {
      assert.equal(filter.tenant, tenant);
      const rows = model === Journal ? filter.entryType === 'reversal' ? [] : [{ _id: 'journal', refDocType: 'SalesOrder', refDoc: 'quote', entryType: 'sales_revenue', lines: [{ account: '1000', debit: 100 }, { account: '4000', credit: 100 }] }]
        : model === Sales ? sales : model === Order ? [] : invoices.filter((invoice) => filter.$or.some((clause) => clause.source === invoice.source && clause.sourceId.$in.map(String).includes(invoice.sourceId)));
      return { select: () => ({ lean: async () => rows }) };
    };
  }
  return readSourceReceipts(tenant);
}
test('quotation receipt opens the saved invoice of its converted Sales order', async (t) => {
  const [row] = await receipts(t, [quotation], [savedInvoice]);
  assert.equal(row.invoice?.href, '/accounting/invoices/invoice');
  assert.equal(row.sourceHref, '/sales/quote');
  assert.equal(row.amount, 100);
});
test('direct source invoice takes priority over a converted target', async (t) => {
  const direct = { ...savedInvoice, _id: 'original', sourceId: 'quote', number: 'INV-OLD' };
  const [row] = await receipts(t, [quotation], [savedInvoice, direct]);
  assert.equal(row.invoice?.id, 'original');
});
test('missing converted invoice keeps a verified receipt without inventing an invoice link', async (t) => {
  const [row] = await receipts(t, [quotation], []);
  assert.equal(row.invoice, undefined);
  assert.equal(row.amount, 100);
});
test('an ordinary Sales record cannot redirect its receipt through a convertedTo field', async (t) => {
  const [row] = await receipts(t, [{ ...quotation, docType: 'sales_order' }], [savedInvoice]);
  assert.equal(row.invoice, undefined);
});
