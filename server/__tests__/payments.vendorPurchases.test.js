const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../services/accountingPayment.browse');
const Payment = require('../models/VendorPayment');
const Bill = require('../models/VendorBill');
const PO = require('../models/PurchaseOrder');
const tenant = new mongoose.Types.ObjectId(), vendor = new mongoose.Types.ObjectId();
function mockPayments(t, rows = []) {
  const chain = { sort: () => chain, skip: () => chain, limit: () => chain, populate: () => chain, lean: async () => rows };
  const queries = [];
  t.mock.method(Payment, 'find', (query) => { queries.push(query); return chain; });
  t.mock.method(Payment, 'countDocuments', async (query) => { queries.push(query); return rows.length; });
  t.mock.method(Payment, 'aggregate', async (pipeline) => { queries.push(pipeline[0].$match); return []; });
  return queries;
}
test('vendor selection scopes rows, count and totals in the trusted tenant', async (t) => {
  const queries = mockPayments(t);
  await service.listPayments(tenant, 'vendor', { vendor: String(vendor) });
  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.equal(String(query.tenant), String(tenant));
    assert.equal(String(query.vendor), String(vendor));
  }
});
test('invalid vendor selection fails before payment queries', async (t) => {
  const queries = mockPayments(t);
  await assert.rejects(service.listPayments(tenant, 'vendor', { vendor: 'invalid' }), /Invalid vendor/);
  assert.equal(queries.length, 0);
});
test('vendor allocation includes current bill balance and its tenant-scoped purchase order', async (t) => {
  const bill = new mongoose.Types.ObjectId(), po = new mongoose.Types.ObjectId();
  mockPayments(t, [{ _id: 'payment', amount: 30, status: 'active', allocations: [{ vendorBill: bill, amount: 30 }] }]);
  t.mock.method(Bill, 'find', (query) => {
    assert.equal(String(query.tenant), String(tenant));
    return { select: () => ({ lean: async () => [{ _id: bill, billNumber: 'BILL-1', purchaseOrder: po, totalAmount: 100, paidAmount: 30, status: 'partial' }] }) };
  });
  t.mock.method(PO, 'find', (query) => {
    assert.equal(String(query.tenant), String(tenant));
    return { select: () => ({ lean: async () => [{ _id: po, poNumber: 'PO-1' }] }) };
  });
  const result = await service.listPayments(tenant, 'vendor');
  const allocation = result.data[0].allocations[0];
  assert.equal(allocation.document.outstanding, 70);
  assert.equal(allocation.document.status, 'partial');
  assert.equal(allocation.purchaseOrder.href, `/purchases/${po}`);
  assert.equal(allocation.purchaseOrder.label, 'PO-1');
  assert.equal(result.data[0].status, 'active');
});
test('payments endpoint passes the selected vendor into the scoped browse service', async (t) => {
  const writeService = require('../services/accountingPayment.service');
  const controller = require('../controllers/arAp.controller');
  let selected;
  t.mock.method(writeService, 'listPayments', async (owner, side, options) => {
    assert.equal(String(owner), String(tenant)); assert.equal(side, 'vendor');
    selected = options.vendor;
    return { data: [], page: 1, pages: 1, total: 0, paymentSummary: {} };
  });
  let error;
  await controller.listPayments({ user: { tenant }, query: { side: 'vendor', vendor: String(vendor) }, body: {} }, { json: () => {} }, (e) => { error = e; });
  assert.equal(error, undefined);
  assert.equal(selected, String(vendor));
});
