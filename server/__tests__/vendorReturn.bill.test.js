const test = require('node:test');
const assert = require('node:assert/strict');
const { adjustBillForReturn } = require('../services/vendorReturn.bill');
function fixture(status = 'paid') {
  const bill = { _id: 'b', status, items: [{ subProductId: 'p', sizeId: 's', quantity: 10, unitPrice: 100, taxRate: 10, amount: 1100 }], subtotal: 1000, taxAmount: 100, totalAmount: 1100, paidAmount: status === 'paid' ? 1100 : 0, payments: [{ amount: 1100 }], save: async () => {} };
  const queries = [];
  const deps = { VendorBill: { findOne: q => { queries.push(q); return { sort: async () => bill }; } } };
  const ret = { _id: 'r', purchaseOrder: 'po', vendorBill: 'b', items: [{ subProductId: 'p', sizeId: 's', quantity: 4 }] };
  return { bill, ret, queries, run: action => adjustBillForReturn('t', ret, action, deps) };
}
test('paid invoice return updates the exact invoice while preserving original invoice and payment history', async () => {
  const f = fixture(); await f.run('deduct');
  assert.equal(f.queries[0]._id, 'b'); assert.equal(f.queries[0].tenant, 't');
  assert.equal(f.bill.items[0].quantity, 6); assert.equal(f.bill.totalAmount, 660);
  assert.equal(f.bill.originalInvoice.items[0].quantity, 10);
  assert.equal(f.bill.originalInvoice.totalAmount, 1100);
  assert.equal(f.bill.paidAmount, 1100); assert.deepEqual(f.bill.payments, [{ amount: 1100 }]);
});
test('invoice adjustment and cancellation are idempotent and restore only the recorded quantities', async () => {
  const f = fixture('confirmed'); await f.run('deduct'); await f.run('deduct');
  assert.equal(f.bill.totalAmount, 660);
  f.ret.items[0].quantity = 8;
  await f.run('restore'); await f.run('restore');
  assert.equal(f.bill.items[0].quantity, 10); assert.equal(f.bill.totalAmount, 1100);
});
test('bill history read is tenant scoped and includes only invoice links or recorded adjustments', async () => {
  const { getBillReturns } = require('../services/vendorReturn.bill');
  const rows = [{ _id: 'r' }];
  const result = await getBillReturns({ _id: 'b', returnAdjustments: [{ vendorReturn: 'r' }] }, 't', {
    VendorReturn: { findOne: () => { throw new Error('not used'); }, find(q) {
      assert.equal(q.tenant, 't'); assert.deepEqual(q.$or, [{ vendorBill: 'b' }, { _id: { $in: ['r'] } }]);
      return { sort: () => ({ lean: async () => rows }) };
    } },
  });
  assert.deepEqual(result, rows);
});
test('real Mongoose invoices retain snapshot quantities and cancelled return history', async () => {
  const mongoose = require('mongoose');
  const Bill = require('../models/VendorBill');
  const id = () => new mongoose.Types.ObjectId();
  const bill = new Bill({ tenant: id(), billNumber: 'B', vendorName: 'V', status: 'partial', paidAmount: 300, items: [{ subProductId: id(), quantity: 10, unitPrice: 100, taxRate: 0, amount: 1000 }], subtotal: 1000, taxAmount: 0, totalAmount: 1000 });
  bill.save = async () => bill;
  const ret = { _id: id(), vendorBill: bill._id, purchaseOrder: id(), items: [{ subProductId: bill.items[0].subProductId, quantity: 8 }] };
  const deps = { VendorBill: { findOne: () => ({ sort: async () => bill }) } };
  await adjustBillForReturn(bill.tenant, ret, 'deduct', deps);
  assert.equal(bill.status, 'paid'); assert.equal(bill.totalAmount, 200);
  assert.equal(bill.toObject().originalInvoice.items[0].quantity, 10);
  await adjustBillForReturn(bill.tenant, ret, 'restore', deps);
  await adjustBillForReturn(bill.tenant, ret, 'restore', deps);
  assert.equal(bill.status, 'partial'); assert.equal(bill.items[0].quantity, 10);
  assert.equal(bill.returnAdjustments[0].active, false);
  assert.equal(String(bill.returnAdjustments[0].vendorReturn), String(ret._id));
});
