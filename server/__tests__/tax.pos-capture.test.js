const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Tax = require('../models/Tax');
const TaxRecord = require('../models/TaxRecord');
const { captureDocumentTax } = require('../services/tax.service');
const id = () => new mongoose.Types.ObjectId();
const doc = (extra = {}) => ({ _id: id(), tenant: id(), receiptNumber: 'POS-1', taxAmount: 75,
  paidAt: new Date('2026-08-12T10:00:00Z'), items: [{ itemSubtotal: 1000, taxRate: 7.5, taxAmount: 75 }], ...extra });
function storage(t, rows = []) {
  t.mock.method(Tax, 'find', () => ({ lean: async () => [] }));
  t.mock.method(TaxRecord, 'find', () => ({ lean: async () => rows }));
  const write = t.mock.method(TaxRecord, 'findOneAndUpdate', async (filter, update) => {
    const prior = rows.find(row => row.taxRate === filter.taxRate);
    if (prior) return prior;
    const row = { _id: id(), ...update.$setOnInsert };
    rows.push(row); return row;
  });
  return { rows, write };
}
test('receipt VAT is stored once on its sale date, with tenant scope', async t => {
  const { rows, write } = storage(t);
  const receipt = doc();
  await captureDocumentTax({ sourceType: 'pos', doc: receipt, strict: true });
  await captureDocumentTax({ sourceType: 'pos', doc: receipt, strict: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].taxAmount, 75);
  assert.equal(rows[0].postedAt, receipt.paidAt);
  assert.equal(rows[0].sourceNumber, 'POS-1');
  for (const call of write.mock.calls) assert.equal(call.arguments[0].tenant, receipt.tenant);
});
test('conflicting existing VAT is preserved for explicit reconciliation', async t => {
  const { write } = storage(t, [{ taxRate: 7.5, taxableBase: 1000, taxAmount: 70 }]);
  t.mock.method(console, 'error', () => {});
  await assert.rejects(captureDocumentTax({ sourceType: 'pos', doc: doc(), strict: true }), /differs from receipt/);
  assert.equal(write.mock.callCount(), 0);
});
test('inconsistent header and line VAT cannot create a false ledger entry', async t => {
  const { write } = storage(t);
  t.mock.method(console, 'error', () => {});
  await assert.rejects(captureDocumentTax({ sourceType: 'pos', doc: doc({ taxAmount: 80 }), strict: true }), /does not reconcile/);
  assert.equal(write.mock.callCount(), 0);
});
test('POS capture refuses a linked invoice receipt to prevent double VAT', async t => {
  const { write } = storage(t);
  t.mock.method(console, 'error', () => {});
  await assert.rejects(captureDocumentTax({ sourceType: 'pos', doc: doc({ linkedSalesOrder: id() }), strict: true }), /invoice owns VAT/);
  assert.equal(write.mock.callCount(), 0);
});

test('positive VAT without a recorded rate requires reconciliation', async t => {
  const { write } = storage(t);
  t.mock.method(console, 'error', () => {});
  await assert.rejects(captureDocumentTax({ sourceType: 'pos', strict: true,
    doc: doc({ items: [{ itemSubtotal: 1000, taxRate: 0, taxAmount: 75 }] }),
  }), /rate/);
  assert.equal(write.mock.callCount(), 0);
});
