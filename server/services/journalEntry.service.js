// services/journalEntry.service.js
//
// Double-entry posting glue. Pure math lives in accounting.helpers.js; this
// module resolves account codes, enforces balance and idempotency (unique
// {tenant, refDoc, entryType}), and pairs reversals. Posted entries are never
// mutated or deleted — corrections are new entries.

const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const {
  normalizeLines,
  isBalanced,
  periodOf,
  swapLinesForReversal,
} = require('./accounting.helpers');

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Resolve legacy free-string account codes to Account documents for a tenant.
 * Unknown or inactive codes reject with 400. Lines already carrying accountId
 * pass through untouched.
 */
async function resolveAccounts(tenantId, lines) {
  const codes = [...new Set(lines.filter((l) => !l.accountId && l.account).map((l) => l.account))];
  if (!codes.length) return lines;
  const accounts = await Account.find({ tenant: tenantId, code: { $in: codes } }).lean();
  const byCode = new Map(accounts.map((a) => [String(a.code), a]));
  return lines.map((l) => {
    if (l.accountId) return l;
    const account = byCode.get(l.account);
    if (!account) throw badRequest(`Unknown account code "${l.account}"`);
    if (!account.isActive) throw badRequest(`Account "${account.name}" (${l.account}) is inactive`);
    return { ...l, accountId: account._id };
  });
}

/**
 * Post an entry. Backwards compatible with the original signature
 * ({tenantId, date, lines, source, refDoc, refDocType, memo, postedBy}) —
 * entryType defaults to 'manual'. Idempotent: when an entry already exists
 * for {tenant, refDoc, entryType} it is replaced in place (posted docs keep
 * their _id) instead of duplicating against the unique index.
 */
async function postJournalEntry({
  tenantId,
  date,
  lines,
  source,
  refDoc,
  refDocType,
  memo,
  postedBy,
  entryType = 'manual',
  status = 'posted',
}) {
  const rounded = normalizeLines(lines);
  if (!isBalanced(rounded)) {
    throw badRequest(
      Math.abs(
        rounded.reduce((s, l) => s + l.debit, 0) - rounded.reduce((s, l) => s + l.credit, 0)
      ) > 0.01
        ? 'Journal entry is not balanced'
        : 'Journal entry has no amount'
    );
  }
  const resolved = await resolveAccounts(tenantId, rounded);
  const when = date ? new Date(date) : new Date();
  const payload = {
    tenant: tenantId,
    refDoc,
    refDocType: refDocType || 'SalesOrder',
    entryType,
    date: when,
    period: periodOf(when),
    source: source || 'sales_order',
    lines: resolved,
    memo,
    postedBy: postedBy || undefined,
    status,
    postedAt: new Date(),
  };

  const existing = await JournalEntry.findOne({
    tenant: tenantId,
    refDoc,
    entryType,
  });
  if (existing) {
    if (existing.status === 'posted' && status !== 'draft') {
      // Re-capture: refresh the financials on the same document.
      existing.set(payload);
      return existing.save();
    }
    return existing; // drafts are only promoted explicitly, never overwritten
  }
  return JournalEntry.create(payload);
}

/** Tenant-scoped lookup used by hooks and the reverse endpoint. */
async function findEntry({ tenantId, refDoc, entryType }) {
  return JournalEntry.findOne({ tenant: tenantId, refDoc, entryType }).lean();
}

/**
 * Create the paired reversal of a posted entry (swapped sides, refDoc =
 * original _id, entryType 'reversal'). The original is untouched. Idempotent:
 * returns the existing reversal instead of creating a second one.
 */
async function reverseEntry({ tenantId, entryId, userId }) {
  const original = await JournalEntry.findOne({ _id: entryId, tenant: tenantId });
  if (!original) throw badRequest('Journal entry not found');
  if (original.status !== 'posted') {
    throw badRequest('Only posted entries can be reversed');
  }
  const alreadyReversed = await JournalEntry.findOne({
    tenant: tenantId,
    refDoc: original._id,
    entryType: 'reversal',
  });
  if (alreadyReversed) return alreadyReversed;

  const swapped = swapLinesForReversal(original);
  return JournalEntry.create({
    tenant: tenantId,
    refDoc: original._id,
    refDocType: original.refDocType,
    entryType: 'reversal',
    date: new Date(),
    period: periodOf(new Date()),
    source: original.source,
    lines: swapped.lines,
    memo: swapped.memo || `Reversal of ${original.refDocType} entry`,
    postedBy: userId,
    status: 'posted',
  });
}

module.exports = {
  postJournalEntry,
  findEntry,
  resolveAccounts,
  reverseEntry,
};
