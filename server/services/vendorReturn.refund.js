const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { round2 } = require('./tax.helpers');

const METHODS = ['credit_note', 'bank_transfer', 'cash', 'cheque', 'other'];
const REFUNDABLE = ['confirmed', 'requested', 'shipped', 'in_transit', 'received'];

function validateRefund(data = {}) {
  const amount = typeof data.amount === 'number' ? data.amount : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || round2(amount) <= 0 ||
      Math.abs(amount - round2(amount)) > 1e-8) {
    throw new ValidationError('Refund amount must be positive money with at most two decimal places');
  }
  if (!METHODS.includes(data.method)) throw new ValidationError('Choose a valid refund method');
  if (data.requestId && (typeof data.requestId !== 'string' || data.requestId.length > 100)) {
    throw new ValidationError('Invalid refund request id');
  }
  return {
    amount: round2(amount), method: data.method,
    reference: String(data.reference || '').trim().slice(0, 200),
    notes: String(data.notes || '').trim().slice(0, 2000),
    requestId: data.requestId || undefined,
  };
}

// Allocate each settlement's share of inventory and tax. The final settlement
// takes the rounding remainder so the history sums exactly to the document.
function refundLines(doc, refund, previous) {
  const total = round2(doc.totalAmount);
  const beforeInventory = round2((Number(doc.subtotal) || 0) * previous / total);
  const afterInventory = round2((Number(doc.subtotal) || 0) * (previous + refund.amount) / total);
  const inventory = round2(afterInventory - beforeInventory);
  const tax = round2(refund.amount - inventory);
  return [
    { account: refund.method === 'credit_note' ? '2000' : refund.method === 'cash' ? '1000' : '1100', debit: refund.amount, credit: 0, memo: doc.returnNumber },
    { account: '1200', debit: 0, credit: inventory, memo: 'Stock returned to vendor' },
    { account: '1400', debit: 0, credit: tax, memo: 'Input VAT reversal' },
  ];
}

async function recordVendorRefund({ id, tenantId, userId, data }, deps = {}) {
  const clean = validateRefund(data);
  const Model = deps.VendorReturn || require('../models/VendorReturn');
  const transaction = deps.transaction || (run => mongoose.connection.transaction(run));
  const journal = deps.postJournalEntry || require('./journalEntry.service').postJournalEntry;
  const ensureCOA = deps.ensureDefaultCOA || require('./chartOfAccounts.service').ensureDefaultCOA;
  // Seed before the transaction takes its read snapshot; accounts created
  // outside that snapshot would otherwise be invisible on the first refund.
  await ensureCOA(tenantId);
  const result = await transaction(async session => {
    const doc = await Model.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!doc) throw new NotFoundError('Vendor return not found');
    const existing = clean.requestId && (doc.refunds || []).find(r => r.requestId === clean.requestId);
    if (existing) {
      if (existing.amount !== clean.amount || existing.method !== clean.method ||
          existing.reference !== clean.reference || existing.notes !== clean.notes) {
        throw new ValidationError('This refund request was already used with different details');
      }
      return doc;
    }
    if (!Number.isFinite(doc.totalAmount) || doc.totalAmount <= 0 ||
        !Number.isFinite(doc.subtotal) || doc.subtotal < 0 || doc.subtotal > doc.totalAmount ||
        !Number.isFinite(doc.refundAmount || 0) || (doc.refundAmount || 0) < 0 || (doc.refundAmount || 0) > doc.totalAmount) {
      throw new ValidationError('Return totals must be corrected before recording a refund');
    }
    if (!REFUNDABLE.includes(doc.status)) throw new ValidationError('Return must be confirmed before recording a refund');
    const previous = round2(doc.refundAmount || 0);
    const remaining = round2(doc.totalAmount - previous);
    if (clean.amount > remaining) throw new ValidationError('Refund amount exceeds the remaining return balance');
    const refund = { _id: new mongoose.Types.ObjectId(), ...clean, recordedBy: userId, date: new Date() };
    const next = round2(previous + clean.amount);
    doc.refundAmount = next;
    doc.refundMethod = clean.method;
    doc.refundReference = clean.reference;
    doc.refundDate = refund.date;
    doc.refundStatus = next >= round2(doc.totalAmount) ? 'completed' : 'processing';
    if (doc.refundStatus === 'completed') {
      doc.status = 'refunded';
      doc.refundedDate = refund.date;
    }
    doc.refunds = [...(doc.refunds || []), refund];
    await doc.save({ session });
    if (!doc.currency || doc.currency === 'NGN') {
      await journal({ tenantId, date: refund.date, lines: refundLines(doc, refund, previous),
        source: 'vendor_return', refDoc: refund._id, refDocType: 'VendorReturnRefund',
        entryType: 'refund', memo: `Refund ${doc.returnNumber}: ${clean.reference || clean.method}`,
        postedBy: userId, session });
    }
    return doc;
  });
  return result;
}

module.exports = { validateRefund, refundLines, recordVendorRefund, REFUNDABLE };
