// Accounting records payments already received/paid; it never calls a gateway.
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const CustomerPayment = require('../models/CustomerPayment');
const VendorPayment = require('../models/VendorPayment');
const SalesOrder = require('../models/SalesOrder');
const VendorBill = require('../models/VendorBill');
const POSCustomer = require('../models/POSCustomer');
const Vendor = require('../models/Vendor');
const JournalEntry = require('../models/JournalEntry');
const journal = require('./journalEntry.service');
const { ensureDefaultCOA } = require('./chartOfAccounts.service');
const { validatePayment, paymentLines } = require('./accountingPayment.helpers');
const { round2 } = require('./accounting.helpers');
const { bad, dateRange, AR_FILTER, AP_FILTER } = require('./accounting.query');
const model = direction => direction === 'customer' ? CustomerPayment : VendorPayment;

async function loadAllocations(tenantId, direction, allocations, session, cancelling = false) {
  const ar = direction === 'customer';
  const key = ar ? 'salesOrder' : 'vendorBill';
  const Model = ar ? SalesOrder : VendorBill;
  const docs = [];
  for (const allocation of allocations) {
    if (!mongoose.isValidObjectId(allocation[key])) throw bad('Invalid allocation document');
    const doc = await Model.findOne({ _id: allocation[key], tenant: tenantId,
      ...(cancelling ? {} : ar ? { currency: AR_FILTER.currency, docType: AR_FILTER.docType, orderStatus: AR_FILTER.orderStatus } : AP_FILTER) }).session(session);
    if (!doc) throw bad('Allocation document is not available in this tenant');
    if (doc.currency && doc.currency !== 'NGN') throw bad('Accounting payments currently support NGN documents only');
    const total = Number(ar ? doc.total : doc.totalAmount) || 0;
    const effective = ar && !cancelling ? await require('./customerInvoice/creditBalance').effectiveCreditInvoice(tenantId, doc, session) : doc;
    const paid = Number(ar ? effective.amountPaid : doc.paidAmount) || 0;
    if (!cancelling && allocation.amount > round2(total - paid - (ar ? effective.creditedAmount || 0 : 0))) throw bad('Allocation exceeds the outstanding document balance');
    if (cancelling && allocation.amount > paid) throw bad('Document payment balance has changed; reconcile it before cancelling');
    docs.push({ doc, amount: allocation.amount });
  }
  return docs;
}

async function updateAllocations(docs, direction, payment, session, sign = 1) {
  const ar = direction === 'customer';
  for (const { doc, amount } of docs) {
    const paidField = ar ? 'amountPaid' : 'paidAmount';
    doc[paidField] = round2((doc[paidField] || 0) + sign * amount);
    const paid = doc[paidField];
    const total = ar ? doc.total : doc.totalAmount;
    doc[ar ? 'paymentStatus' : 'status'] = paid >= total ? 'paid' : paid > 0 ? 'partial' : ar ? 'unpaid' : 'confirmed';
    if (!ar) {
      const reference = `accounting:${payment._id}`;
      if (sign > 0) doc.payments.push({ amount, date: payment.date, method: ['cash', 'bank_transfer', 'card'].includes(payment.method) ? payment.method : 'other', reference, recordedBy: payment.createdBy });
      else doc.payments = doc.payments.filter(p => p.reference !== reference);
    }
    await doc.save({ session });
  }
}

async function createPayment({ tenantId, direction, data, userId, session: outerSession }) {
  const clean = validatePayment(data, direction);
  // Wallet movement must use the wallet service; recording it here would leave
  // the stored-value balance unchanged while claiming it had been consumed.
  if (clean.method === 'wallet') throw bad('Record wallet payments through POS or the sales order');
  const date = data.date ? new Date(data.date) : new Date();
  if (Number.isNaN(date.getTime())) throw bad('Invalid payment date');
  await ensureDefaultCOA(tenantId);
  // An outer session lets a caller commit this payment TOGETHER with any other
  // record it produces. Without one, the payment is journaled and its sub-ledger
  // row may not be written — leaving a customer looking like they still owe money
  // they have already handed over.
  const run = async session => {
    const docs = await loadAllocations(tenantId, direction, clean.allocations, session);
    const partyKey = direction === 'customer' ? 'customer' : 'vendor';
    const partyIds = new Set(docs.map(({ doc }) => String(doc[partyKey] || doc.customerSnapshot?.customerId || '')).filter(Boolean));
    if (data[partyKey]) partyIds.add(String(data[partyKey]));
    if (partyIds.size > 1) throw bad('A payment can only cover one customer or vendor');
    const partyId = [...partyIds][0];
    let party;
    if (partyId) {
      if (!mongoose.isValidObjectId(partyId)) throw bad('Invalid customer or vendor');
      party = await (direction === 'customer' ? POSCustomer : Vendor).findOne({ _id: partyId, tenant: tenantId }).session(session);
      if (!party) throw bad('Customer or vendor not found in this tenant');
    }
    const name = party ? (direction === 'customer' ? `${party.firstName || ''} ${party.lastName || ''}`.trim() : party.name) : data[`${partyKey}Name`];
    if (!name && !partyId) throw bad('A customer or vendor name is required');
    const [payment] = await model(direction).create([{
      tenant: tenantId, number: `${direction === 'customer' ? 'PAY' : 'VPAY'}-${date.getUTCFullYear()}-${randomUUID().slice(0, 13)}`,
      ...clean, [partyKey]: partyId, [`${partyKey}Name`]: name,
      date, reference: data.reference, createdBy: userId,
    }], { session });
    await updateAllocations(docs, direction, payment, session);
    await journal.postJournalEntry({ tenantId, date, lines: paymentLines(payment, direction),
      source: `${direction}_payment`, refDoc: payment._id,
      refDocType: direction === 'customer' ? 'CustomerPayment' : 'VendorPayment',
      entryType: `${direction}_payment`, memo: `Payment ${payment.number}`, postedBy: userId, session });
    return payment;
  };
  return outerSession ? run(outerSession) : mongoose.connection.transaction(run);
}

async function cancelPayment({ tenantId, direction, id, userId }) {
  return mongoose.connection.transaction(async session => {
    const payment = await model(direction).findOne({ _id: id, tenant: tenantId }).session(session);
    if (!payment) throw bad('Payment not found');
    if (payment.status !== 'active' || payment.batch) throw bad('Only active, unbatched payments can be cancelled');
    const docs = await loadAllocations(tenantId, direction, payment.allocations, session, true);
    const entry = await JournalEntry.findOne({ tenant: tenantId, refDoc: payment._id, entryType: `${direction}_payment` }).session(session);
    if (!entry) throw bad('Payment journal is missing; reconcile before cancelling');
    await journal.reverseEntry({ tenantId, entryId: entry._id, userId, session });
    await updateAllocations(docs, direction, payment, session, -1);
    payment.status = 'cancelled';
    await payment.save({ session });
    if (direction === 'customer') for (const { doc } of docs)
      await require('./customerInvoice/sync').syncSource({ tenantId, source: 'sales', sourceId: doc._id, session });
    return payment;
  });
}
async function listPayments(tenantId, direction, options = {}) {
  return require('./accountingPayment.browse').listPayments(tenantId, direction, options);
}

module.exports = { createPayment, cancelPayment, listPayments };
