// controllers/accounting.controller.js
//
// Thin handlers over journalEntry.service / chartOfAccounts.service /
// accounting.service. Tenant comes from the JWT chain only; privileged
// actions write AuditLog entries (Workstream C).

const asyncHandler = require('../utils/asyncHandler');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { logPrivilegedAction } = require('../utils/auditLog');
const journalService = require('../services/journalEntry.service');
const coaService = require('../services/chartOfAccounts.service');
const accountingService = require('../services/accounting.service');

function bad(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ── Journal entries ───────────────────────────────────────────────────────────

exports.getJournalEntries = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { period, entryType, refDocType, status, account } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const filter = { tenant: tenantId };
  if (period) filter.period = period;
  if (entryType) filter.entryType = entryType;
  if (refDocType) filter.refDocType = refDocType;
  if (status) filter.status = status;
  if (account) filter['lines.account'] = String(account);
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }

  const [data, total] = await Promise.all([
    JournalEntry.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('postedBy', 'name')
      .lean(),
    JournalEntry.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.getJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({ _id: req.params.id, tenant: req.tenant._id })
    .populate('postedBy', 'name')
    .lean();
  if (!entry) throw bad('Journal entry not found', 404);
  res.json({ success: true, data: entry });
});

/** Manual entry: server resolves codes → accounts; AuditLog accounting.manual_entry. */
exports.createJournalEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { date, lines, memo } = req.body;
  if (!Array.isArray(lines) || lines.length < 2) {
    throw bad('At least two lines are required for a manual entry');
  }
  const entry = await journalService.postJournalEntry({
    tenantId,
    date,
    lines,
    memo,
    source: 'manual',
    refDocType: 'Manual',
    postedBy: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.manual_entry', 'create', {
    targetType: 'JournalEntry',
    targetId: entry._id,
    targetTenantId: tenantId,
  });
  res.status(201).json({ success: true, data: entry });
});

/** Paired reversal; original untouched. AuditLog accounting.reverse. */
exports.reverseJournalEntry = asyncHandler(async (req, res) => {
  const reversed = await journalService.reverseEntry({
    tenantId: req.tenant._id,
    entryId: req.params.id,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.reverse', 'update', {
    targetType: 'JournalEntry',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.status(201).json({ success: true, data: reversed });
});

/** Draft-only delete; posted entries must be reversed instead. */
exports.deleteJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({ _id: req.params.id, tenant: req.tenant._id });
  if (!entry) throw bad('Journal entry not found', 404);
  if (entry.status === 'posted') {
    throw bad('Posted entries cannot be deleted — reverse them instead', 409);
  }
  await entry.deleteOne();
  await logPrivilegedAction(req, 'accounting.draft_delete', 'delete', {
    targetType: 'JournalEntry',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, message: 'Draft entry deleted' });
});

// ── Chart of Accounts ────────────────────────────────────────────────────────

async function seedIfEmpty(tenantId) {
  const count = await Account.countDocuments({ tenant: tenantId });
  if (count === 0) await coaService.ensureDefaultCOA(tenantId);
}

exports.getAccounts = asyncHandler(async (req, res) => {
  await seedIfEmpty(req.tenant._id);
  const data = await coaService.listAccounts(req.tenant._id, {
    type: req.query.type,
    isActive: req.query.isActive,
  });
  res.json({ success: true, data });
});

exports.createAccount = asyncHandler(async (req, res) => {
  const { code, name, type, description } = req.body;
  if (!code || !name || !['asset', 'liability', 'equity', 'income', 'expense'].includes(type)) {
    throw bad('code, name and a valid type are required');
  }
  const account = await coaService.createAccount(req.tenant._id, req.body, req.user._id);
  await logPrivilegedAction(req, 'accounting.coa_create', 'create', {
    targetType: 'Account',
    targetId: account._id,
    targetTenantId: req.tenant._id,
  });
  res.status(201).json({ success: true, data: account });
});

exports.updateAccount = asyncHandler(async (req, res) => {
  const account = await coaService.updateAccount(req.tenant._id, req.params.id, req.body, req.user._id);
  await logPrivilegedAction(req, 'accounting.coa_update', 'update', {
    targetType: 'Account',
    targetId: account._id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, data: account });
});

exports.deleteAccount = asyncHandler(async (req, res) => {
  await coaService.deleteAccount(req.tenant._id, req.params.id);
  await logPrivilegedAction(req, 'accounting.coa_delete', 'delete', {
    targetType: 'Account',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, message: 'Account deleted' });
});

// ── Reports + dashboard ──────────────────────────────────────────────────────

exports.getTrialBalance = asyncHandler(async (req, res) => {
  const data = await accountingService.getTrialBalance(req.tenant._id, { period: req.query.period });
  const status = data.balanced ? 200 : 207; // 207 = out-of-balance warning payload
  res.status(status).json({ success: true, data });
});

exports.getProfitLoss = asyncHandler(async (req, res) => {
  const data = await accountingService.getProfitLoss(req.tenant._id, {
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
});

exports.getBalanceSheet = asyncHandler(async (req, res) => {
  const data = await accountingService.getBalanceSheet(req.tenant._id, { asOf: req.query.asOf });
  const status = data.balanced ? 200 : 207;
  res.status(status).json({ success: true, data });
});

exports.getGeneralLedger = asyncHandler(async (req, res) => {
  const data = await accountingService.getGeneralLedger(req.tenant._id, {
    account: req.query.account,
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
});

exports.getDashboard = asyncHandler(async (req, res) => {
  const data = await accountingService.getDashboard(req.tenant._id, {
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
});
