const mongoose = require('mongoose');
const assert = require('node:assert/strict');
async function verifyDetailRead(tenant, other, invoice) {
  const Tenant = require('../../models/Tenant');
  const Payment = require('../../models/CustomerPayment');
  const Credit = require('../../models/CreditNote');
  const Invoice = require('../../models/CustomerInvoice');
  const Journal = require('../../models/JournalEntry');
  await Tenant.collection.insertOne({ _id: tenant, name: 'Invoice shop', bankName: 'Settlement bank', bankAccountNumber: '999', bankAccounts: [{ bankName: 'Customer bank', accountNumber: '0123456789' }, { bankName: 'Invalid', accountNumber: 'ABC' }] });
  await Payment.collection.insertMany([
    { tenant, number: 'PAY-DETAIL', amount: 100, status: 'active', date: new Date('2026-10-13'), allocations: [{ salesOrder: invoice.sourceId, amount: 25 }, { salesOrder: new mongoose.Types.ObjectId(), amount: 75 }] },
    { tenant: other, number: 'FOREIGN-PAYMENT', amount: 100, allocations: [{ salesOrder: invoice.sourceId, amount: 100 }] },
  ]);
  await Credit.collection.insertMany([
    { tenant, number: 'CN-DETAIL', amount: 10, postedAt: new Date(), status: 'cancelled', allocations: [{ salesOrder: invoice.sourceId, amount: 6 }] },
    { tenant: other, number: 'FOREIGN-CREDIT', postedAt: new Date(), allocations: [{ salesOrder: invoice.sourceId, amount: 99 }] },
  ]);
  const before = await Invoice.findOne({ _id: invoice._id, tenant }).lean();
  const journals = await Journal.countDocuments();
  const detail = await require('../../services/customerInvoice/browse').getInvoice(tenant, invoice._id);
  assert.equal(detail.detailContext.issuer.name, 'Invoice shop');
  assert.equal(detail.detailContext.issuer.bankAccounts.length, 1);
  assert.equal(detail.detailContext.activity.find(row => row.label === 'PAY-DETAIL').amount, 25);
  assert.equal(detail.detailContext.activity.find(row => row.label === 'CN-DETAIL').status, 'cancelled');
  assert.equal(detail.detailContext.activity.some(row => row.label.startsWith('FOREIGN')), false);
  assert.deepEqual(await Invoice.findOne({ _id: invoice._id, tenant }).lean(), before);
  assert.equal(await Journal.countDocuments(), journals);
}
module.exports = { verifyDetailRead };
