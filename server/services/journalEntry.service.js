// services/journalEntry.service.js
const JournalEntry = require('../models/JournalEntry');

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

async function postJournalEntry({ tenantId, date, lines, source, refDoc, refDocType, memo, postedBy }) {
  const rounded = (lines || []).map((l) => ({
    account: String(l.account),
    debit: round2(l.debit),
    credit: round2(l.credit),
    memo: l.memo || undefined,
  }));
  const debitSum = rounded.reduce((s, l) => s + l.debit, 0);
  const creditSum = rounded.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(debitSum - creditSum) > 0.01) {
    const err = new Error('Journal entry is not balanced');
    err.status = 400;
    throw err;
  }
  if (debitSum === 0 && creditSum === 0) {
    const err = new Error('Journal entry has no amount');
    err.status = 400;
    throw err;
  }
  const period =
    date && date instanceof Date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : undefined;
  return JournalEntry.create({
    tenant: tenantId,
    refDoc,
    refDocType: refDocType || 'SalesOrder',
    entryType: 'manual',
    date: date || new Date(),
    period,
    source: source || 'sales_order',
    lines: rounded,
    memo,
    postedBy,
    status: 'posted',
  });
}

async function findEntry({ tenantId, refDoc, entryType }) {
  return JournalEntry.findOne({ tenant: tenantId, refDoc, entryType }).lean();
}

module.exports = { postJournalEntry, findEntry };