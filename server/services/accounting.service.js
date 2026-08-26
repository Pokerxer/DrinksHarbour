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
} = require('./accounting.helpers');
const { getSummary } = require('./tax.service');

const dateFilter = ({ from, to }) => {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return filter;
};

async function fetchEntries(tenantId, { from, to, period } = {}) {
  const filter = { tenant: tenantId, status: 'posted' };
  const date = period || from || to ? {} : undefined;
  if (date) {
    if (period) {
      const [y, m] = String(period).split('-').map(Number);
      if (!y || !m) {
        const err = new Error('period must be YYYY-MM');
        err.status = 400;
        throw err;
      }
      date.$gte = new Date(y, m - 1, 1);
      date.$lt = new Date(y, m, 1);
    } else {
      Object.assign(date, dateFilter({ from, to }) || {});
    }
    filter.date = date;
  }
  return JournalEntry.find(filter).sort({ date: 1 }).lean();
}

/** Per-account debit/credit totals + closing balance for a period. */
async function getTrialBalance(tenantId, { period } = {}) {
  const [entries, accounts] = await Promise.all([
    fetchEntries(tenantId, { period }),
    Account.find({ tenant: tenantId }).lean(),
  ]);
  return buildTrialBalance(entries, accounts);
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
async function getProfitLoss(tenantId, { from, to } = {}) {
  const [entries, taxSummary] = await Promise.all([
    fetchEntries(tenantId, { from, to }),
    getSummary(tenantId, { from, to }),
  ]);
  let movementTotals = null;
  if (entries.length === 0 || !entries.some((e) => e.lines.some((l) => String(l.account).startsWith('5')))) {
    movementTotals = await movementTotalsForWindow(tenantId, { from, to });
  }
  return buildProfitLoss(entries, taxSummary, movementTotals);
}

/** Assets/liabilities/equity as of a moment; RE = cumulative net profit. */
async function getBalanceSheet(tenantId, { asOf } = {}) {
  const filter = { tenant: tenantId, status: 'posted' };
  if (asOf) filter.date = { $lte: new Date(asOf) };
  const entries = await JournalEntry.find(filter).sort({ date: 1 }).lean();
  const lifetime = buildProfitLoss(entries, {});
  return buildBalanceSheet(entries, asOf, lifetime.netProfit);
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
  };
}

/** KPI payload for the Accounting dashboard (all MTD unless dates given). */
async function getDashboard(tenantId, { from, to } = {}) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const window = { from: from || startOfMonth.toISOString(), to: to || now.toISOString() };

  const [pl, taxSummary, recent, draftCount, sixMonthEntries] = await Promise.all([
    getProfitLoss(tenantId, window),
    getSummary(tenantId, window),
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
  ]);

  return {
    kpis: {
      revenueMtd: pl.revenueTotal,
      expensesMtd: round2(pl.cogs.total + pl.expenseTotal),
      netProfitMtd: pl.netProfit,
      grossProfitMtd: pl.grossProfit,
      taxCollectedMtd: taxSummary.collected,
      taxPaidMtd: taxSummary.paid,
      unpostedDraftCount: draftCount,
    },
    profitLoss: pl,
    monthly: buildMonthlySeries(sixMonthEntries, periodOf(now)),
    recentEntries: recent,
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
