// services/accounting.helpers.js
//
// Pure accounting math — no Mongoose. Trial balance, P&L, balance sheet,
// general ledger and reversal pairing all live here so they are testable
// without a database (same contract as tax.helpers.js).

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Coerce API lines into schema shape with kobo-precision amounts. */
function normalizeLines(lines) {
  return (lines || []).map((l) => ({
    account: String(l.account || '').trim(),
    accountId: l.accountId || undefined,
    debit: round2(l.debit),
    credit: round2(l.credit),
    memo: l.memo || undefined,
  }));
}

/** Double-entry check: sums equal within ±0.01 and the entry is non-zero. */
function isBalanced(lines) {
  const debit = (lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const credit = (lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (round2(debit) === 0 && round2(credit) === 0) return false;
  return Math.abs(debit - credit) <= 0.01;
}

/** 'YYYY-MM' period key from a date. */
function periodOf(date) {
  if (!date) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Paired reversal: same accounts, swapped sides. The caller wraps these in a
 * NEW entry whose refDoc points at the original — posted entries never change.
 */
function swapLinesForReversal(entry) {
  const lines = (entry.lines || []).map((l) => ({
    account: l.account,
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    memo: l.memo,
  }));
  const memo = entry?.memo ? `Reversal of ${entry.memo}` : undefined;
  return { lines, memo };
}

const TYPE_ORDER = { asset: 0, liability: 1, equity: 2, income: 3, expense: 4 };

// Asset/expense accounts carry debit balances; liability/equity/income carry
// credit balances.
const DEBIT_NATURE = new Set(['asset', 'expense']);

/** Closing balance per account: debits − credits for debit-nature types. */
function closingFor(type, debits, credits) {
  const net = round2(debits - credits);
  return DEBIT_NATURE.has(type) ? net : round2(credits - debits);
}

function metaMap(accounts) {
  const map = new Map();
  for (const a of accounts || []) map.set(String(a.code), a);
  return map;
}

function blankRow(code, meta) {
  return {
    code,
    name: meta?.name || code,
    type: meta?.type || 'asset',
    debits: 0,
    credits: 0,
    closing: 0,
  };
}

/** Per-account debit/credit totals + closing balance; flags out-of-balance. */
function buildTrialBalance(entries, accounts) {
  const meta = metaMap(accounts);
  const rows = new Map();
  let totalDebits = 0;
  let totalCredits = 0;
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      const code = String(line.account);
      const row = rows.get(code) || blankRow(code, meta.get(code));
      row.debits = round2(row.debits + (Number(line.debit) || 0));
      row.credits = round2(row.credits + (Number(line.credit) || 0));
      rows.set(code, row);
    }
  }
  const list = [...rows.values()].map((r) => ({
    ...r,
    closing: closingFor(r.type, r.debits, r.credits),
  }));
  list.sort(
    (a, b) =>
      (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
      String(a.code).localeCompare(String(b.code))
  );
  for (const r of list) {
    totalDebits = round2(totalDebits + r.debits);
    totalCredits = round2(totalCredits + r.credits);
  }
  return {
    rows: list,
    totalDebits,
    totalCredits,
    balanced: Math.abs(totalDebits - totalCredits) <= 0.01 && totalDebits > 0,
  };
}

function sumType(entries, type, accounts) {
  const codes = new Set((accounts || []).filter((a) => a.type === type).map((a) => String(a.code)));
  const byAccount = new Map();
  let total = 0;
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      if (!codes.has(String(line.account))) continue;
      const delta = type === 'income'
        ? round2((Number(line.credit) || 0) - (Number(line.debit) || 0))
        : round2((Number(line.debit) || 0) - (Number(line.credit) || 0));
      const row = byAccount.get(line.account) || { code: line.account, amount: 0 };
      row.amount = round2(row.amount + delta);
      byAccount.set(line.account, row);
      total = round2(total + delta);
    }
  }
  return { total, rows: [...byAccount.values()] };
}

/**
 * P&L: income − expenses over a window. COGS (account 5000 / entryTypes
 * cogs|refund) is broken out of operating expenses. Tax collected/paid come
 * from the TaxRecord summary join, not journal lines.
 */
function buildProfitLoss(entries, taxSummary = {}, movementTotals = null) {
  // COGS-bearing entries when no COA metadata is available yet.
  const cogsEntryTypes = new Set(['cogs', 'refund']);
  let revenueTotal = 0;
  let expenseTotal = 0;
  let cogsTotal = 0;
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      const code = String(line.account);
      const netDebit = round2((Number(line.debit) || 0) - (Number(line.credit) || 0));
      if (code.startsWith('4')) {
        revenueTotal = round2(revenueTotal - netDebit); // credits increase revenue
      } else if (code.startsWith('5')) {
        cogsTotal = round2(cogsTotal + netDebit);
      } else if (/^[6789]/.test(code)) {
        expenseTotal = round2(expenseTotal + netDebit);
      }
      // Balance-sheet codes (1xxxx cash/assets, 2xxx payables…) don't hit P&L.
    }
  }
  const derived =
    movementTotals && cogsTotal === 0 && movementTotals.cogs > 0
      ? { ...movementTotals, source: 'derived' }
      : { ...movementTotals, source: 'journal' };
  const finalCogs = cogsTotal > 0 ? { total: cogsTotal, source: 'journal' } : derived;
  return {
    revenueTotal,
    cogs: { total: round2(finalCogs.total || 0), source: finalCogs.source },
    expenseTotal,
    grossProfit: round2(revenueTotal - finalCogs.total),
    netProfit: round2(revenueTotal - finalCogs.total - expenseTotal),
    tax: {
      collected: round2(taxSummary.collected || 0),
      paid: round2(taxSummary.paid || 0),
    },
  };
}

/**
 * Balance sheet as of a moment. Retained earnings passed in by the service
 * (= cumulative net profit across all time, simple v1 without period close).
 */
function buildBalanceSheet(entries, _asOf, retainedEarnings = 0) {
  const assetsByCode = new Map();
  const liabByCode = new Map();
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      const code = String(line.account);
      const bucket = code.startsWith('1')
        ? assetsByCode
        : code.startsWith('2')
          ? liabByCode
          : null; // income/equity codes surface via retained earnings instead
      if (!bucket) continue;
      const row = bucket.get(code) || { code, amount: 0 };
      row.amount = round2(
        row.amount +
          (bucket === assetsByCode
            ? (Number(line.debit) || 0) - (Number(line.credit) || 0)
            : (Number(line.credit) || 0) - (Number(line.debit) || 0))
      );
      bucket.set(code, row);
    }
  }
  const toRows = (m) => [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  const assets = { rows: toRows(assetsByCode), total: round2([...assetsByCode.values()].reduce((s, r) => s + r.amount, 0)) };
  const liabilities = { rows: toRows(liabByCode), total: round2([...liabByCode.values()].reduce((s, r) => s + r.amount, 0)) };
  const equity = {
    rows: [
      { code: '3100', amount: round2(retainedEarnings) },
    ],
    total: round2(retainedEarnings),
  };
  return {
    assets,
    liabilities,
    equity,
    balanced:
      Math.abs(assets.total - (liabilities.total + equity.total)) <= 0.01 &&
      assets.total >= 0,
  };
}

/**
 * Per-account line listing in chronological order with a running balance.
 * The balance follows the account's natural side — debit-nature accounts
 * (assets/expenses) run debits−credits, credit-nature accounts (liabilities/
 * equity/income) run credits−debits — starting from `openingBalance` so a
 * dated window continues history instead of restarting at zero.
 */
function buildGeneralLedger(entries, accountCode, { openingBalance = 0, creditNature = false } = {}) {
  const lines = [];
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      if (String(line.account) !== String(accountCode)) continue;
      lines.push({
        date: entry.date,
        entryId: entry._id,
        refDocType: entry.refDocType,
        memo: line.memo || entry.memo,
        debit: round2(line.debit),
        credit: round2(line.credit),
      });
    }
  }
  lines.sort((a, b) => new Date(a.date) - new Date(b.date));
  let balance = round2(openingBalance);
  let debits = 0;
  let credits = 0;
  for (const l of lines) {
    balance = round2(creditNature ? balance + l.credit - l.debit : balance + l.debit - l.credit);
    debits = round2(debits + l.debit);
    credits = round2(credits + l.credit);
    l.balance = balance;
  }
  return { lines, totals: { debits, credits, closing: balance }, openingBalance: round2(openingBalance) };
}

const COGS_MOVEMENT_TYPES = new Set(['sold', 'shipped']);
const LOSS_MOVEMENT_TYPES = new Set(['damaged', 'expired', 'theft', 'written_off']);

/** Derived-COGS fallback from inventory movements when no entries exist. */
function sumMovementCosts(movements) {
  let cogs = 0;
  let losses = 0;
  for (const m of movements || []) {
    const cost = round2(m.totalCost ?? (m.unitCost || 0) * Math.abs(m.quantity || 0));
    if (COGS_MOVEMENT_TYPES.has(m.type)) cogs = round2(cogs + cost);
    else if (LOSS_MOVEMENT_TYPES.has(m.type)) losses = round2(losses + cost);
  }
  return { cogs, losses };
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sequential document number: PREFIX-YYYY-0001 (per-tenant counters upstream). */
function nextDocNumber(prefix, count, year = new Date().getFullYear()) {
  return `${prefix}-${year}-${String((Number(count) || 0) + 1).padStart(4, '0')}`;
}

/** AR aging bucket from days outstanding. */
function agingBucket(days) {
  if (days <= 15) return 'current';
  if (days <= 30) return '16-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Allocation guard for payments: Σ allocations must not exceed the payment
 * amount, each allocation must not exceed its document's outstanding balance,
 * and every referenced doc must exist. Returns { ok, total, errors[] }.
 */
function validateAllocations({ amount, allocations, outstandingByDoc }) {
  const errors = [];
  let total = 0;
  for (const a of allocations || []) {
    const docId = String(a.docId);
    const alloc = round2(a.amount);
    if (alloc <= 0) {
      errors.push(`Allocation to ${docId} must be positive`);
      continue;
    }
    total = round2(total + alloc);
    const outstanding = outstandingByDoc[docId];
    if (outstanding === undefined) {
      errors.push(`Document ${docId} not found or not open`);
      continue;
    }
    if (alloc > round2(outstanding) + 0.001) {
      errors.push(
        `Allocation of ${alloc} to ${docId} exceeds its outstanding balance of ${round2(outstanding)}`
      );
    }
  }
  if (total > round2(amount) + 0.001) {
    errors.push(`Allocations total ${total} exceed payment amount ${round2(amount)}`);
  }
  return { ok: errors.length === 0, total, errors };
}

/**
 * Dashboard chart series: revenue vs operating expenses bucketed per period,
 * padded to the 6 months ending at `endPeriod` ('YYYY-MM'). Entries outside
 * the window are ignored.
 */
function buildMonthlySeries(entries, endPeriod, months = 6) {
  const [ey, em] = String(endPeriod || periodOf(new Date())).split('-').map(Number);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ey, em - 1 - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ period, label: MONTH_LABELS[d.getMonth()], revenue: 0, expenses: 0 });
  }
  const byPeriod = new Map(buckets.map((b) => [b.period, b]));
  for (const entry of entries || []) {
    const bucket = byPeriod.get(String(entry.period));
    if (!bucket) continue;
    for (const line of entry.lines || []) {
      const code = String(line.account);
      if (code.startsWith('4')) {
        bucket.revenue = round2(bucket.revenue + (Number(line.credit) || 0) - (Number(line.debit) || 0));
      } else if (/^[56789]/.test(code)) {
        bucket.expenses = round2(bucket.expenses + (Number(line.debit) || 0) - (Number(line.credit) || 0));
      }
    }
  }
  return buckets;
}

/** Escape a user string for literal use inside a RegExp. */
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PERIOD_RX = /^\d{4}-\d{2}$/;

/**
 * Pure translation of the journal-entries list query into a Mongo filter
 * (tenant added by the caller). Unknown/invalid values are ignored rather
 * than rejected so a bad filter can never 500 the list view. `q` is a safe
 * literal contains-match over memo and source; `account` matches line codes.
 */
function buildJournalEntryFilter(query = {}) {
  const filter = {};
  if (PERIOD_RX.test(String(query.period || ''))) filter.period = query.period;
  if (query.entryType) filter.entryType = String(query.entryType);
  if (query.refDocType) filter.refDocType = String(query.refDocType);
  if (query.status) filter.status = String(query.status);
  if (query.account) filter['lines.account'] = String(query.account).trim();
  if (query.from || query.to) {
    filter.date = {};
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!Number.isNaN(from.getTime())) filter.date.$gte = from;
    if (!Number.isNaN(to.getTime())) filter.date.$lte = to;
    if (!Object.keys(filter.date).length) delete filter.date;
  }
  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ memo: rx }, { source: rx }];
  }
  return filter;
}

module.exports = {
  round2,
  normalizeLines,
  isBalanced,
  periodOf,
  swapLinesForReversal,
  buildTrialBalance,
  buildProfitLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  sumMovementCosts,
  buildMonthlySeries,
  nextDocNumber,
  agingBucket,
  validateAllocations,
  escapeRegExp,
  buildJournalEntryFilter,
};
