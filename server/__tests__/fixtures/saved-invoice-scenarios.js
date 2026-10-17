const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Sales = require('../../models/SalesOrder');
const Order = require('../../models/Order');
const Journal = require('../../models/JournalEntry');
const Invoice = require('../../models/CustomerInvoice');
const { syncSource } = require('../../services/customerInvoice/sync');
const oid = () => new mongoose.Types.ObjectId();
const posting = (tenant, refDoc, amount, account = '1300', refDocType = 'SalesOrder', entryType = 'sales_revenue') =>
  Journal.collection.insertOne({ tenant, refDoc, refDocType, entryType, status: 'posted',
    lines: [{ account, debit: amount, credit: 0 }, { account: entryType === 'customer_payment' ? '1300' : '4000', debit: 0, credit: amount }] });
async function fifoAndLinked(tenant) {
  const customer = oid(), old = oid(), newer = oid(), payment = oid();
  const Statement = require('../../models/CustomerAccountStatement');
  const Payment = require('../../models/CustomerPayment');
  await Order.collection.insertMany([
    { _id: old, tenant, source: 'pos', receiptNumber: 'TAB-OLD', status: 'confirmed', paymentStatus: 'paid', totalAmount: 100, subtotal: 100,
      items: [{ name: 'Older wine', quantity: 1, priceAtPurchase: 100, itemSubtotal: 100 }], paymentDetails: { accountCharge: 100, customer: { customerId: customer, firstName: 'Ada' } }, createdAt: new Date('2026-10-10') },
    { _id: newer, tenant, source: 'pos', receiptNumber: 'TAB-NEW', status: 'confirmed', paymentStatus: 'paid', totalAmount: 80, subtotal: 80,
      items: [{ name: 'New wine', quantity: 1, priceAtPurchase: 80, itemSubtotal: 80 }], paymentDetails: { accountCharge: 80, customer: { customerId: customer, firstName: 'Ada' } }, createdAt: new Date('2026-10-11') },
  ]);
  await posting(tenant, old, 100, '1300', 'Order'); await posting(tenant, newer, 80, '1300', 'Order');
  await Statement.collection.insertMany([
    { tenant, customer, entryType: 'charge', amount: 100, receiptNumber: 'TAB-OLD', voided: false, occurredAt: new Date('2026-10-10') },
    { tenant, customer, entryType: 'charge', amount: 80, receiptNumber: 'TAB-NEW', voided: false, occurredAt: new Date('2026-10-11') },
    { tenant, customer, entryType: 'payment', amount: 120, reference: 'PAY-FIFO', voided: false, occurredAt: new Date('2026-10-12') },
  ]);
  await Payment.collection.insertOne({ _id: payment, tenant, customer, number: 'PAY-FIFO', status: 'active', amount: 120, allocations: [] });
  await posting(tenant, payment, 120, '1000', 'CustomerPayment', 'customer_payment');
  const first = await syncSource({ tenantId: tenant, source: 'pos', sourceId: old });
  const second = await syncSource({ tenantId: tenant, source: 'pos', sourceId: newer });
  assert.equal(first.state, 'posted'); assert.equal(first.paymentStatus, 'paid');
  assert.equal(second.state, 'posted'); assert.equal(second.amountPaid, 20); assert.equal(second.outstanding, 60);
  assert.equal(second.paymentStatus, 'partial'); assert.equal(second.payments.length, 1);
  const browse = await require('../../services/customerInvoice/browse').listInvoices(tenant, { from: '2026-10-11', to: '2026-10-11' });
  assert.equal(browse.data.find(d => String(d.sourceId) === String(newer)).outstanding, 60);
  // A stale statement cannot claim that a cancelled payment settled an invoice.
  await require('../../services/accountingPayment.service').cancelPayment({ tenantId: tenant, direction: 'customer', id: payment });
  const cancelledPayment = await Invoice.findOne({ tenant, source: 'pos', sourceId: old });
  assert.equal(cancelledPayment.amountPaid, 0); assert.equal(cancelledPayment.paymentStatus, 'unpaid');
  assert.match(cancelledPayment.reconciliationIssue, /repayments/);
  const sales = oid(), receipt = oid();
  await Sales.collection.insertOne({ _id: sales, tenant, soNumber: 'SO-LINKED', docType: 'order', orderStatus: 'fulfilled', total: 200, amountPaid: 200, paymentStatus: 'paid', items: [], createdAt: new Date('2026-10-13') });
  await Order.collection.insertOne({ _id: receipt, tenant, source: 'pos', receiptNumber: 'LINKED-POS', linkedSalesOrder: sales, paymentStatus: 'paid', totalAmount: 200, items: [], createdAt: new Date('2026-10-13') });
  await posting(tenant, sales, 200); await posting(tenant, receipt, 200, '1000', 'Order', 'customer_payment');
  const canonical = await syncSource({ tenantId: tenant, source: 'pos', sourceId: receipt });
  assert.equal(canonical.source, 'sales'); assert.equal(canonical.state, 'posted'); assert.equal(canonical.amountPaid, 200);
  assert.equal(await Invoice.countDocuments({ tenant, source: 'pos', sourceId: receipt }), 0);
  const retry = await syncSource({ tenantId: tenant, source: 'sales', sourceId: sales });
  assert.equal(String(retry._id), String(canonical._id));
  const concurrentSource = oid();
  await Sales.collection.insertOne({ _id: concurrentSource, tenant, soNumber: 'SO-CONCURRENT', docType: 'order', orderStatus: 'fulfilled', amountPaid: 0, total: 50, items: [], createdAt: new Date('2026-10-13') });
  await posting(tenant, concurrentSource, 50);
  const repeated = await Promise.all(Array.from({ length: 6 }, () => syncSource({ tenantId: tenant, source: 'sales', sourceId: concurrentSource })));
  assert.equal(new Set(repeated.map(d => String(d._id))).size, 1);
  assert.equal(await Invoice.countDocuments({ tenant, sourceId: concurrentSource }), 1);
}
async function manualIssueAndPayments(tenant) {
  const source = await Sales.create({ tenant, soNumber: 'MANUAL-1', docType: 'quotation', quoteStatus: 'draft', invoiceDraft: true,
    total: 100, subtotal: 100, customerSnapshot: { name: 'Walk-in' },
    items: [{ name: 'Manual wine', subproduct: oid(), lineType: 'product', quantity: 1, unitPrice: 100, lineTotal: 100 }] });
  const draft = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(draft.state, 'draft');
  await require('../../services/accountingInvoice.service').issueInvoice({ tenantId: tenant, id: source._id });
  const issued = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(String(issued._id), String(draft._id)); assert.equal(issued.state, 'posted');
  assert.equal(issued.outstanding, 100);
  const id = await require('../../services/customerInvoice/browse').salesSourceId(tenant, issued._id);
  assert.equal(String(id), String(source._id));
  const accountingPayment = require('../../services/accountingPayment.service');
  const paid = await accountingPayment.createPayment({ tenantId: tenant, direction: 'customer', data: { customerName: 'Walk-in', amount: 40, method: 'cash', allocations: [{ salesOrder: id, amount: 40 }] } });
  const partial = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(partial.amountPaid, 40); assert.equal(partial.paymentStatus, 'partial'); assert.equal(partial.outstanding, 60);
  const beforeRetry = await Journal.countDocuments({ tenant, refDoc: source._id, entryType: 'sales_revenue' });
  await require('../../services/accountingInvoice.service').issueInvoice({ tenantId: tenant, id: source._id });
  assert.equal(await Journal.countDocuments({ tenant, refDoc: source._id, entryType: 'sales_revenue' }), beforeRetry);
  await accountingPayment.cancelPayment({ tenantId: tenant, direction: 'customer', id: paid._id });
  const unpaid = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(unpaid.amountPaid, 0); assert.equal(unpaid.paymentStatus, 'unpaid'); assert.equal(unpaid.outstanding, 100);
  const creditSvc = require('../../services/creditNote.service');
  const note = await creditSvc.createCreditNote({ tenantId: tenant, data: { customerName: 'Walk-in', salesOrder: source._id, amount: 25 } });
  await creditSvc.postCreditNote({ tenantId: tenant, id: note._id });
  const credited = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(credited.creditedAmount, 25); assert.equal(credited.outstanding, 75); assert.equal(credited.reconciliationIssue, '');
  await creditSvc.cancelCreditNote({ tenantId: tenant, id: note._id });
  const uncredited = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(uncredited.creditedAmount, 0); assert.equal(uncredited.outstanding, 100);
  const cancelledSource = await Sales.findOne({ _id: source._id, tenant });
  cancelledSource.orderStatus = 'cancelled'; await cancelledSource.save();
  const cancelled = await Invoice.findOne({ tenant, sourceId: source._id });
  assert.equal(cancelled.state, 'cancelled'); assert.equal(cancelled.outstanding, 0);
  cancelledSource.orderStatus = 'fulfilled'; await cancelledSource.save();
  assert.equal((await Invoice.findOne({ tenant, sourceId: source._id })).state, 'cancelled');
}
module.exports = { fifoAndLinked, manualIssueAndPayments };
