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
 * Unknown, inactive or mismatched tenant accounts reject with 400.
 */
async function resolveAccounts(tenantId, lines, session) {
  const codes = [...new Set(lines.filter((l) => l.account).map((l) => l.account))];
  if (!codes.length) return lines;
  const query = Account.find({ tenant: tenantId, code: { $in: codes } });
  if (session) query.session(session);
  const accounts = await query.lean();
  const byCode = new Map(accounts.map((a) => [String(a.code), a]));
  return lines.map((l) => {

    const account = byCode.get(l.account);
    if (!account) throw badRequest(`Unknown account code "${l.account}"`);
    if (!account.isActive) throw badRequest(`Account "${account.name}" (${l.account}) is inactive`);
    if (l.accountId && String(l.accountId) !== String(account._id)) throw badRequest('Account ID does not match this tenant account');
    return { ...l, accountId: account._id };
  });
}

/**
 * Post an entry. Backwards compatible with the original signature
 * ({tenantId, date, lines, source, refDoc, refDocType, memo, postedBy}) —
 * entryType defaults to 'manual'. Idempotent: when an entry already exists
 * for {tenant, refDoc, entryType}, the immutable original is returned.
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
  session,
}) {
  if (!tenantId) throw badRequest('Tenant is required');
  if (!Array.isArray(lines) || lines.some(l =>
    !Number.isFinite(Number(l.debit ?? 0)) || !Number.isFinite(Number(l.credit ?? 0)) ||
    Number(l.debit) < 0 || Number(l.credit) < 0 || (Number(l.debit) > 0 && Number(l.credit) > 0))) {
    throw badRequest('Use at least two lines with finite non-negative amounts on one side per line');
  }
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
  if (lines.length < 2) throw badRequest('Use at least two journal lines');
  const resolved = await resolveAccounts(tenantId, rounded, session);
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

  // Manual entries have no business-document identity: always append.
  if (!refDoc) {
    if (session) return (await JournalEntry.create([payload], { session }))[0];
    return JournalEntry.create(payload);
  }
  // A retry must never rewrite a posted entry (especially one already reversed).
  return JournalEntry.findOneAndUpdate(
    { tenant: tenantId, refDoc, entryType },
    { $setOnInsert: payload },
    { upsert: true, new: true, runValidators: true, ...(session ? { session } : {}) }
  );
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
async function reverseEntry({ tenantId, entryId, userId, session }) {
  const original = await JournalEntry.findOne({ _id: entryId, tenant: tenantId }).session(session || null);
  if (!original) throw badRequest('Journal entry not found');
  if (original.status !== 'posted') {
    throw badRequest('Only posted entries can be reversed');
  }
  const alreadyReversed = await JournalEntry.findOne({
    tenant: tenantId, refDoc: original._id, entryType: 'reversal',
  }).session(session || null);
  if (alreadyReversed) return alreadyReversed;

  const swapped = swapLinesForReversal(original);
  return JournalEntry.findOneAndUpdate(
    { tenant: tenantId, refDoc: original._id, entryType: 'reversal' },
    { $setOnInsert: {
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
  } }, { upsert: true, new: true, runValidators: true, ...(session ? { session } : {}) });
}

module.exports = {
  postJournalEntry,
  findEntry,
  resolveAccounts,
  reverseEntry,
};
