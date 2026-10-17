const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.PAYMENT_WORKSPACE_TEST_URI;
test('payment workspace totals, links, vendor scope and refunded-invoice receipt reversal stay consistent', { skip: !uri }, async (t) => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_payments_workspace_test_\w+$/);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const db = mongoose.connection.db;
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid(), other = oid(), customer = oid(), vendor = oid(), source = oid(), bill = oid(), po = oid();
  await db.collection('poscustomers').insertOne({ _id: customer, tenant, firstName: 'Ada[' });
  await db.collection('vendors').insertOne({ _id: vendor, tenant, name: 'Supplier[' });
  await db.collection('purchaseorders').insertOne({ _id: po, tenant, poNumber: 'PO-1' });
  await db.collection('customerinvoices').insertOne({ tenant, source: 'sales', sourceId: source, number: 'INV-1' });
  await db.collection('vendorbills').insertMany([{ _id: bill, tenant, vendor, vendorName: 'Supplier[', createdBy: oid(), purchaseOrder: po, billNumber: 'BILL-1', currency: 'NGN', status: 'partial', totalAmount: 100, paidAmount: 30, payments: [], billDate: new Date() }, { _id: oid(), tenant, vendor: oid(), billNumber: 'BILL-OTHER', currency: 'NGN', status: 'confirmed', totalAmount: 100, paidAmount: 0, billDate: new Date() }]);
  await db.collection('customerpayments').insertMany([
    { tenant, customer, number: 'PAY-1', amount: 100, method: 'cash', date: new Date('2026-10-14'), status: 'active', allocations: [{ salesOrder: source, amount: 60 }] },
    { tenant, customer, number: 'PAY-2', amount: 50, method: 'card', date: new Date('2026-10-13'), status: 'active', allocations: [] },
    { tenant, customer, number: 'PAY-3', amount: 10, method: 'cash', date: new Date('2026-10-12'), status: 'cancelled', allocations: [] },
    { tenant: other, number: 'PAY-X', amount: 9999, method: 'cash', date: new Date(), status: 'active', allocations: [] },
  ]);
  await db.collection('vendorpayments').insertOne({ tenant, vendor, number: 'VPAY-1', amount: 30, method: 'bank_transfer', date: new Date(), status: 'active', allocations: [{ vendorBill: bill, amount: 30 }] });
  const service = require('../services/accountingPayment.service');
  const result = await service.listPayments(tenant, 'customer', { limit: 1 });
  assert.equal(result.total, 3); assert.equal(result.data.length, 1);
  assert.equal(result.paymentSummary.activeAmount, 150); assert.equal(result.paymentSummary.allocated, 60); assert.equal(result.paymentSummary.unallocated, 90); assert.equal(result.paymentSummary.cancelledAmount, 10);
  assert.equal(result.data[0].allocations[0].document.label, 'INV-1');
  assert.equal((await service.listPayments(tenant, 'customer', { search: 'Ada[' })).total, 3);
  assert.equal((await service.listPayments(tenant, 'customer', { method: 'cash', status: 'active' })).total, 1);
  const payouts = await service.listPayments(tenant, 'vendor');
  assert.equal(payouts.data[0].allocations[0].document.href, `/purchases/bills/${bill}`);
  assert.equal((await require('../services/arAp.service').listOpenDocs(tenant, 'ap', { vendor: String(vendor) })).total, 1);
  assert.equal(payouts.data[0].allocations[0].purchaseOrder.href, `/purchases/${po}`);
  assert.equal(payouts.data[0].allocations[0].document.outstanding, 70);
  assert.equal((await service.listPayments(tenant, 'vendor', { vendor: String(oid()) })).total, 0);
  const paid = await service.createPayment({ tenantId: tenant, direction: 'vendor', userId: oid(), data: { vendor, amount: 70, method: 'cash', allocations: [{ vendorBill: bill, amount: 70 }] } });
  let paidBill = await db.collection('vendorbills').findOne({ _id: bill });
  assert.equal(paidBill.status, 'paid'); assert.equal(paidBill.paidAmount, 100);
  assert.equal(paidBill.payments.length, 1);
  const paidRows = await service.listPayments(tenant, 'vendor', { vendor: String(vendor) });
  assert.equal(paidRows.total, 2); assert.equal(paidRows.paymentSummary.activeAmount, 100);
  assert.equal(paidRows.data.find(r => String(r._id) === String(paid._id)).allocations[0].document.status, 'paid');
  await service.cancelPayment({ tenantId: tenant, direction: 'vendor', id: paid._id, userId: oid() });
  paidBill = await db.collection('vendorbills').findOne({ _id: bill });
  assert.equal(paidBill.status, 'partial'); assert.equal(paidBill.paidAmount, 30);
  assert.equal(paidBill.payments.length, 0);
  const cancelledRows = await service.listPayments(tenant, 'vendor', { vendor: String(vendor) });
  assert.equal(cancelledRows.paymentSummary.activeAmount, 30); assert.equal(cancelledRows.paymentSummary.cancelledAmount, 70);
  assert.equal(cancelledRows.data.find(r => String(r._id) === String(paid._id)).allocations[0].document.outstanding, 70);
  const foreignPO = oid();
  await db.collection('purchaseorders').insertOne({ _id: foreignPO, tenant: other, poNumber: 'FOREIGN-PO' });
  await db.collection('vendorbills').updateOne({ _id: bill }, { $set: { purchaseOrder: foreignPO } });
  assert.equal((await service.listPayments(tenant, 'vendor')).data[0].allocations[0].purchaseOrder, undefined);

  // The real existing Sales/POS fixture supplies matching immutable invoice and journal evidence.
  const fixture = await require('./fixtures/invoice-return-records').seed(db);
  const { ids, posting, salesInvoice, syncSource } = fixture;
  await db.collection('orders').updateOne({ _id: ids.pos }, { $set: { paymentStatus: 'partially_refunded', refunds: [{ _id: ids.refund, receiptNumber: 'RETURN-40', totalRefunded: 40, refundedAt: new Date(), items: [{ orderItemIndex: 0, quantity: 4, restockedQuantity: 4 }] }] } });
  await posting(ids.refund, 'OrderRefund', 'refund', '1300', '1000', 40);
  const sync = () => syncSource({ tenantId: ids.tenant, source: 'sales', sourceId: ids.sales });
  assert.equal((await sync()).outstanding, 40);
  const payment = await service.createPayment({ tenantId: ids.tenant, direction: 'customer', userId: oid(), data: { customer: ids.customer, amount: 40, method: 'cash', allocations: [{ salesOrder: ids.sales, amount: 40 }] } });
  let current = await sync();
  assert.equal(current.outstanding, 0); assert.equal(current.amountPaid, 100); assert.equal(current.total, salesInvoice.total); assert.equal(current.snapshotHash, salesInvoice.snapshotHash);
  assert.equal((await db.collection('salesorders').findOne({ _id: ids.sales })).amountPaid, 140);
  await service.cancelPayment({ tenantId: ids.tenant, direction: 'customer', id: payment._id, userId: oid() });
  current = await sync(); assert.equal(current.outstanding, 40); assert.equal(current.amountPaid, 60);
  assert.equal((await db.collection('salesorders').findOne({ _id: ids.sales })).amountPaid, 100);
  const visible = await service.listPayments(ids.tenant, 'customer');
  assert.equal(visible.total, 3); // two actual POS tenders plus the cancelled manual receipt
  assert.equal(visible.data.filter((row) => row.readOnly).length, 2);
  assert.equal(visible.paymentSummary.activeAmount, 200);
  assert.equal(visible.paymentSummary.refundedAmount, 40);
  assert.equal(visible.paymentSummary.unallocated, 0);
  const linked = visible.data.find((row) => row.sourceId === String(ids.pos));
  assert.equal(linked.invoice.id, String(salesInvoice._id));
  assert.equal((await service.listPayments(ids.tenant, 'customer', { search: 'RCP-LINK', limit: 1 })).total, 1);
  assert.equal((await service.listPayments(ids.other, 'customer')).total, 0);
  assert.equal(await db.collection('journalentries').countDocuments({ tenant: ids.tenant, refDoc: payment._id, entryType: 'customer_payment' }), 1);
});
