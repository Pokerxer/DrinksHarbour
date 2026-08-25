// services/creditNote.service.js
//
// AR credit notes: apply (post refund journal) / cancel (paired reversal).
// v1 always credits Receivables — cash refunds are recorded as negative
// customer payments instead (documented in the RESUME doc).

const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const journalService = require('./journalEntry.service');
const { round2 } = require('./accounting.helpers');
const { CODE } = require('./accounting.posting');

async function nextNumber(tenantId) {
  const count = await CreditNote.countDocuments({ tenant: tenantId });
  return nextWithRetry(tenantId, count, 3);
}

async function nextWithRetry(tenantId, count, attempts) {
  for (let i = 0; i < attempts; i++) {
    const candidate = require('./accounting.helpers').nextDocNumber('CN', count + i);
    const exists = await CreditNote.exists({ tenant: tenantId, number: candidate });
    if (!exists) return candidate;
  }
  return `CN-${Date.now()}`;
}

function buildLines(cn) {
  const total = round2(cn.amount + cn.taxAmount);
  return [
    { account: CODE.SALES_REVENUE, debit: round2(cn.amount), credit: 0, memo: cn.reason || 'Credit note' },
    { account: CODE.TAX_COLLECTED, debit: round2(cn.taxAmount), credit: 0, memo: 'Output VAT adjustment' },
    { account: CODE.RECEIVABLES, debit: 0, credit: total, memo: cn.customerName || 'Customer credit' },
  ];
}

/** Create an applied credit note and post its journal entry. */
async function createCreditNote({ tenantId, data, userId }) {
  const amount = round2(data.amount);
  if (amount <= 0) {
    const err = new Error('Credit note amount must be positive');
    err.status = 400;
    throw err;
  }
  const creditNote = await CreditNote.create({
    tenant: tenantId,
    number: await nextNumber(tenantId),
    customer: data.customer || undefined,
    customerName: data.customerName,
    salesOrder: data.salesOrder || undefined,
    date: data.date ? new Date(data.date) : new Date(),
    reason: data.reason,
    amount,
    taxAmount: round2(data.taxAmount),
    status: 'applied',
    postedBy: userId,
  });

  try {
    await journalService.postJournalEntry({
      tenantId,
      date: creditNote.date,
      lines: buildLines(creditNote),
      source: 'credit_note',
      refDoc: creditNote._id,
      refDocType: 'CreditNote',
      memo: `Credit note ${creditNote.number}`,
      postedBy: userId,
      entryType: 'refund',
    });
  } catch (err) {
    // Keep the document but surface the posting failure — repairable by hand.
    console.error('journalPostFailed', { sourceType: 'credit_note', sourceId: String(creditNote._id), err });
  }
  return creditNote;
}

/** Cancel an applied credit note: paired journal reversal, doc marked cancelled. */
async function cancelCreditNote({ tenantId, id, userId }) {
  const creditNote = await CreditNote.findOne({ _id: id, tenant: tenantId });
  if (!creditNote) {
    const err = new Error('Credit note not found');
    err.status = 404;
    throw err;
  }
  if (creditNote.status !== 'applied') {
    const err = new Error(`Only applied credit notes can be cancelled (status: ${creditNote.status})`);
    err.status = 409;
    throw err;
  }
  const original = await journalService.findEntry({
    tenantId,
    refDoc: creditNote._id,
    entryType: 'refund',
  });
  if (original) {
    await journalService.reverseEntry({ tenantId, entryId: original._id, userId });
  }
  creditNote.status = 'cancelled';
  await creditNote.save();
  return creditNote;
}

async function listCreditNotes(tenantId, { status, from, to, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const [data, total] = await Promise.all([
    CreditNote.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'firstName lastName')
      .lean(),
    CreditNote.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { createCreditNote, cancelCreditNote, listCreditNotes, buildLines };
