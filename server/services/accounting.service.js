// services/accounting.service.js
//
// Report assembly: Mongoose glue over the pure helpers in
// accounting.helpers.js. All queries are tenant-scoped; money is NGN/round2.

const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const InventoryMovement = require('../models/InventoryMovement');
const {
  round2,
  buildTrialBalance,
  buildProfitLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  sumMovementCosts,
  buildMonthlySeries,
  periodOf,
  periodRange,
} = require('./accounting.helpers');
const { getSummary } = require('./tax.service');

const { dateRange: dateFilter, previousWindow } = require('./accounting.query');

async function fetchEntries(tenantId, { from, to, period } = {}) {
  const filter = { tenant: tenantId, status: 'posted' };
  if (period || from || to) {
    filter.date = period
      ? periodRange(period) // UTC bounds; validates the format
      : dateFilter({ from, to }) || {};
  }
  return JournalEntry.find(filter).sort({ date: 1 }).lean();
}

/** Per-account debit/credit totals + closing balance for a period. */
/**
 * Draft entries are excluded from every report. The count is disclosed so a
 * bookkeeper knows the figures are not the whole picture — a trial balance that
 * quietly ignores 40 pending entries reads as final.
 */
/**
 * Whether a window's cost of goods sold has to be estimated from inventory
 * movements — i.e. it carries no 5xxx cost posting of its own.
 */
function needsMovementEstimate(entries) {
  return (
    !entries?.length || !entries.some((e) => e.lines?.some((l) => String(l.account).startsWith('5')))
  );
}

function countDrafts(tenantId) {
  return JournalEntry.countDocuments({ tenant: tenantId, status: 'draft' });
}

async function getTrialBalance(tenantId, { period } = {}) {
  const [entries, accounts, draftsExcluded] = await Promise.all([
    fetchEntries(tenantId, { period }),
    Account.find({ tenant: tenantId }).lean(),
    countDrafts(tenantId),
  ]);
  // entryCount gives the reader scale to check the period against: "847 posted
  // entries plus 3 drafts" is auditable, "balanced" on its own is not.
  return { ...buildTrialBalance(entries, accounts), entryCount: entries.length, draftsExcluded };
}

async function movementTotalsForWindow(tenantId, { from, to }) {
  const filter = { tenant: tenantId };
  const date = dateFilter({ from, to });
  if (date) filter.createdAt = date;
  const movements = await InventoryMovement.find(filter)
    .select('type quantity unitCost totalCost')
    .lean();
  return sumMovementCosts(movements);
}

/**
 * Income − expense for a window. COGS comes from journal entries once the
 * backfill has run; falls back to inventory-movement cost sums ("derived")
 * when no COGS-bearing entries exist yet. Tax lines join the TaxRecord ledger.
 */
async function getProfitLoss(tenantId, { from, to, compare } = {}) {
  const [entries, taxSummary, accounts, draftsExcluded] = await Promise.all([
    fetchEntries(tenantId, { from, to }),
    getSummary(tenantId, { from, to }),
    Account.find({ tenant: tenantId }).lean(),
    countDrafts(tenantId),
  ]);
  const movementTotals = needsMovementEstimate(entries)
    ? await movementTotalsForWindow(tenantId, { from, to })
    : null;
  const pl = buildProfitLoss(entries, taxSummary, movementTotals, accounts);

  // Opt-in comparison against the equally long window immediately before. "All
  // time" has no preceding period, so `previous` stays null rather than showing
  // a variance against nothing.
  const prior = compare ? previousWindow(from, to) : null;
  if (!prior) return { ...pl, draftsExcluded, previous: null, previousWindow: null };

  const [priorEntries, priorTax] = await Promise.all([
    fetchEntries(tenantId, { from: prior.fromISO, to: prior.toISO }),
    getSummary(tenantId, { from: prior.fromISO, to: prior.toISO }),
  ]);
  // The derived-COGS fallback is decided on the prior window's own entries.
  const priorMovement = needsMovementEstimate(priorEntries)
    ? await movementTotalsForWindow(tenantId, { from: prior.fromISO, to: prior.toISO })
    : null;
  const previous = buildProfitLoss(priorEntries, priorTax, priorMovement, accounts);
  return {
    ...pl,
    draftsExcluded,
    previous,
    previousWindow: { from: prior.fromISO, to: prior.toISO },
  };
}

/** Assets/liabilities/equity as of a moment; RE = cumulative net profit. */
async function getBalanceSheet(tenantId, { asOf } = {}) {
  const filter = { tenant: tenantId, status: 'posted' };
  if (asOf) filter.date = dateFilter({ to: asOf });
  const [entries, accounts, draftsExcluded] = await Promise.all([
    JournalEntry.find(filter).sort({ date: 1 }).lean(),
    Account.find({ tenant: tenantId }).lean(),
    countDrafts(tenantId),
  ]);
  const lifetime = buildProfitLoss(entries, {}, null, accounts);
  return { ...buildBalanceSheet(entries, asOf, lifetime.netProfit, accounts), draftsExcluded };
}

/**
 * Nature-aware general ledger: 404 on unknown codes, running balance follows
 * the account's natural side, and a dated window opens with the balance
 * carried forward from pre-window history instead of restarting at zero.
 */
async function getGeneralLedger(tenantId, { account, from, to } = {}) {
  if (!account) {
    const err = new Error('account query param is required');
    err.status = 400;
    throw err;
  }
  const accountDoc = await Account.findOne({ tenant: tenantId, code: String(account) }).lean();
  if (!accountDoc) {
    const err = new Error(`Unknown account code "${account}"`);
    err.status = 404;
    throw err;
  }
  const creditNature = ['liability', 'equity', 'income'].includes(accountDoc.type);
  let openingBalance = 0;
  if (from) {
    const prior = await JournalEntry.find({
      tenant: tenantId,
      status: 'posted',
      date: { $lt: new Date(from) },
    })
      .select('lines')
      .lean();
    for (const entry of prior) {
      for (const line of entry.lines || []) {
        if (String(line.account) !== String(account)) continue;
        openingBalance = creditNature
          ? round2(openingBalance + (line.credit || 0) - (line.debit || 0))
          : round2(openingBalance + (line.debit || 0) - (line.credit || 0));
      }
    }
  }
  const entries = await fetchEntries(tenantId, { from, to });
  const gl = buildGeneralLedger(entries, account, { openingBalance, creditNature });
  return {
    ...gl,
    account: { code: accountDoc.code, name: accountDoc.name, type: accountDoc.type },
    // Without `from` no prior entries are read, so opening is 0 and the closing
    // figure is the movement inside the window, not the account's balance. The
    // UI must be able to say so rather than labelling it a balance.
    openingIncluded: Boolean(from),
  };
}

/** KPI payload for the Accounting dashboard (all MTD unless dates given). */
async function getDashboard(tenantId, { from, to } = {}) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const window = { from: from || startOfMonth.toISOString(), to: to || now.toISOString() };

  const [pl, recent, draftCount, sixMonthEntries, ordersToReview] = await Promise.all([
    getProfitLoss(tenantId, window),
    JournalEntry.find({ tenant: tenantId })
      .sort({ date: -1 })
      .limit(10)
      .populate('postedBy', 'name')
      .lean(),
    JournalEntry.countDocuments({ tenant: tenantId, status: 'draft' }),
    // Chart series source: posted entries in the trailing 6-month window.
    (async () => {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return JournalEntry.find({ tenant: tenantId, status: 'posted', date: { $gte: start } })
        .select('period lines')
        .lean();
    })(),
    require('../models/Order').find({ 'items.tenant': tenantId, accountingStatus: 'needs_review' })
      .select('orderNumber receiptNumber accountingIssue').sort({ accountingCheckedAt: -1 }).limit(10).lean(),
  ]);

  return {
    kpis: {
      revenueMtd: pl.revenueTotal,
      salesMtd: pl.sales.net,
      salesReversalsMtd: pl.sales.reversals,
      postedSalesCount: pl.sales.documentCount,
      expensesMtd: round2(pl.cogs.total + pl.expenseTotal),
      netProfitMtd: pl.netProfit,
      grossProfitMtd: pl.grossProfit,
      taxCollectedMtd: pl.tax.collected,
      taxPaidMtd: pl.tax.paid,
      unpostedDraftCount: draftCount,
    },
    profitLoss: pl,
    monthly: buildMonthlySeries(sixMonthEntries, periodOf(now)),
    recentEntries: recent,
    ordersToReview,
    unpostedDraftCount: draftCount,
  };
}

module.exports = {
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getGeneralLedger,
  getDashboard,
};
