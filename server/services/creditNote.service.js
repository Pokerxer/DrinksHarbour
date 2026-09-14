// services/creditNote.service.js
//
// AR credit notes: apply (post refund journal) / cancel (paired reversal).
// Credits reduce receivables. Cash refunds use their operational refund flow.

const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const journalService = require('./journalEntry.service');
const { round2 } = require('./accounting.helpers');
const { CODE } = require('./accounting.posting');

function buildLines(cn) {
  const total = round2(cn.amount + cn.taxAmount);
  return [
    { account: CODE.SALES_REVENUE, debit: round2(cn.amount), credit: 0, memo: cn.reason || 'Credit note' },
    { account: CODE.TAX_COLLECTED, debit: round2(cn.taxAmount), credit: 0, memo: 'Output VAT adjustment' },
    { account: CODE.RECEIVABLES, debit: 0, credit: total, memo: cn.customerName || 'Customer credit' },
  ];
}

/** Credit, its invoice balance and journal commit together. */
async function createCreditNote({ tenantId, data, userId }) {
  const { bad } = require('./accounting.query');
  const amount = round2(data.amount);
  const taxAmount = round2(data.taxAmount);
  if (!Number.isFinite(Number(data.amount)) || amount <= 0 || !Number.isFinite(Number(data.taxAmount || 0)) || taxAmount < 0) throw bad('Credit amounts must be finite and non-negative');
  const date = data.date ? new Date(data.date) : new Date();
  if (Number.isNaN(date.getTime())) throw bad('Invalid credit date');
  await require('./chartOfAccounts.service').ensureDefaultCOA(tenantId);
  return mongoose.connection.transaction(async session => {
    let so;
    if (data.salesOrder) {
      if (!mongoose.isValidObjectId(data.salesOrder)) throw bad('Invalid invoice');
      so = await require('../models/SalesOrder').findOne({ _id: data.salesOrder, tenant: tenantId, docType: 'order', orderStatus: { $in: ['confirmed', 'partially_fulfilled', 'fulfilled'] } }).session(session);
      if (!so || (so.currency && so.currency !== 'NGN')) throw bad('Invoice not available in this tenant');
      if (round2(amount + taxAmount) > round2(so.total - so.amountPaid - (so.creditedAmount || 0))) throw bad('Credit exceeds outstanding invoice balance');
    }
    const customer = so?.customer || so?.customerSnapshot?.customerId || data.customer;
    if (data.customer && customer && String(data.customer) !== String(customer)) throw bad('Credit customer does not match the invoice');
    if (customer && !(await require('../models/POSCustomer').findOne({ _id: customer, tenant: tenantId }).session(session))) throw bad('Customer not found in this tenant');
    const customerName = so?.customerSnapshot?.name || data.customerName;
    if (!customer && !customerName) throw bad('Customer name is required');
    const [creditNote] = await CreditNote.create([{
      tenant: tenantId, number: `CN-${date.getUTCFullYear()}-${require('node:crypto').randomUUID().slice(0, 13)}`,
      customer, customerName, salesOrder: so?._id, date, reason: data.reason,
      amount, taxAmount, status: 'applied', postedBy: userId,
    }], { session });
    if (so) {
      so.creditedAmount = round2((so.creditedAmount || 0) + amount + taxAmount);
      await so.save({ session });
    }
    await journalService.postJournalEntry({ tenantId, date, lines: buildLines(creditNote),
      source: 'credit_note', refDoc: creditNote._id, refDocType: 'CreditNote',
      memo: `Credit note ${creditNote.number}`, postedBy: userId, entryType: 'refund', session });
    return creditNote;
  });
}

async function cancelCreditNote({ tenantId, id, userId }) {
  const { bad } = require('./accounting.query');
  return mongoose.connection.transaction(async session => {
    const creditNote = await CreditNote.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!creditNote || creditNote.status !== 'applied') throw bad('Only applied credit notes can be cancelled');
    const original = await require('../models/JournalEntry').findOne({ tenant: tenantId, refDoc: creditNote._id, entryType: 'refund' }).session(session);
    if (!original) throw bad('Credit journal is missing; reconcile before cancelling');
    await journalService.reverseEntry({ tenantId, entryId: original._id, userId, session });
    if (creditNote.salesOrder) {
      const so = await require('../models/SalesOrder').findOne({ _id: creditNote.salesOrder, tenant: tenantId }).session(session);
      if (!so || (so.creditedAmount || 0) < round2(creditNote.amount + creditNote.taxAmount)) throw bad('Invoice credit balance needs reconciliation');
      so.creditedAmount = round2(so.creditedAmount - creditNote.amount - creditNote.taxAmount);
      await so.save({ session });
    }
    creditNote.status = 'cancelled';
    await creditNote.save({ session });
    return creditNote;
  });
}

async function listCreditNotes(tenantId, { status, from, to, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  const range = require('./accounting.query').dateRange({ from, to });
  if (range) filter.date = range;
  const [data, total] = await Promise.all([
    CreditNote.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'customer', select: 'firstName lastName', match: { tenant: tenantId } })
      .lean(),
    CreditNote.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { createCreditNote, cancelCreditNote, listCreditNotes, buildLines };
