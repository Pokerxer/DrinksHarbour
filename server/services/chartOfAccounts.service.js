// services/chartOfAccounts.service.js
//
// Chart of Accounts: idempotent default seed + CRUD with referential guard.
// JournalEntry lines reference accounts by their `code` string (legacy
// free-string field), so deletion/deactivation is blocked while entries exist.

const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

/** Beverage-industry default COA (NGN, small-tenant friendly). */
const DEFAULT_COA = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Bank', type: 'asset' },
  { code: '1200', name: 'Inventory', type: 'asset' },
  { code: '1300', name: 'Receivables', type: 'asset' },
  { code: '1400', name: 'Tax Paid (Input VAT)', type: 'asset' },
  { code: '2000', name: 'Payables', type: 'liability' },
  { code: '2100', name: 'Tax Collected (Output VAT)', type: 'liability' },
  { code: '3000', name: "Owner's Equity", type: 'equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity' },
  { code: '4000', name: 'Sales Revenue', type: 'income' },
  { code: '4100', name: 'Other Income', type: 'income' },
  { code: '5000', name: 'COGS', type: 'expense' },
  { code: '6000', name: 'Operating Expenses', type: 'expense' },
  { code: '6100', name: 'Salaries', type: 'expense' },
  { code: '6200', name: 'Rent', type: 'expense' },
  { code: '6300', name: 'Utilities', type: 'expense' },
  { code: '6400', name: 'Marketing', type: 'expense' },
  { code: '6500', name: 'Bank/POS Fees', type: 'expense' },
  { code: '6600', name: 'Freight', type: 'expense' },
  { code: '6700', name: 'Losses/Damage', type: 'expense' },
].map((a) => ({ ...a, isSystem: true }));

function notFound() {
  const err = new Error('Account not found');
  err.status = 404;
  return err;
}

/** Seed any missing default accounts. Idempotent; returns created docs. */
async function ensureDefaultCOA(tenantId) {
  const existing = await Account.find({ tenant: tenantId }).select('code').lean();
  const have = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_COA.filter((a) => !have.has(a.code));
  if (!missing.length) return [];
  return Account.insertMany(
    missing.map((a) => ({ ...a, tenant: tenantId })),
    { ordered: false }
  ).catch((err) => {
    // Race with another first-touch request: duplicates from the unique index
    // are fine — the seed already happened.
    if (err.code === 11000) return [];
    throw err;
  });
}

async function listAccounts(tenantId, { type, isActive } = {}) {
  const filter = { tenant: tenantId };
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
  return Account.find(filter).sort({ code: 1 }).lean();
}

async function createAccount(tenantId, data, userId) {
  const dupe = await Account.findOne({ tenant: tenantId, code: String(data.code || '').trim() });
  if (dupe) {
    const err = new Error(`Account code ${data.code} already exists`);
    err.status = 400;
    throw err;
  }
  return Account.create({
    tenant: tenantId,
    code: String(data.code).trim(),
    name: String(data.name).trim(),
    type: data.type,
    description: data.description,
    isSystem: false,
    isActive: data.isActive !== false,
    createdBy: userId,
  });
}

async function updateAccount(tenantId, id, data, userId) {
  const account = await Account.findOne({ _id: id, tenant: tenantId });
  if (!account) throw notFound();
  if ('code' in data && String(data.code).trim() !== account.code) {
    const err = new Error('Account codes are immutable — create a new account instead');
    err.status = 400;
    throw err;
  }
  for (const key of ['name', 'type', 'description', 'isActive']) {
    if (data[key] !== undefined) account[key] = data[key];
  }
  account.updatedBy = userId;
  return account.save();
}

/**
 * Delete only when no journal line references the code; otherwise signal 409.
 * System accounts are never deleted — callers deactivate them.
 */
async function deleteAccount(tenantId, id) {
  const account = await Account.findOne({ _id: id, tenant: tenantId });
  if (!account) throw notFound();
  const referenced = await JournalEntry.countDocuments({
    tenant: tenantId,
    'lines.account': account.code,
  });
  if (referenced > 0 || account.isSystem) {
    const err = new Error(
      `"${account.name}" (${account.code}) is referenced by ${referenced} journal line(s)` +
        (account.isSystem ? ' and is a system account' : '') +
        '. Deactivate it instead.'
    );
    err.status = 409;
    throw err;
  }
  await account.deleteOne();
}

module.exports = {
  DEFAULT_COA,
  ensureDefaultCOA,
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
};
