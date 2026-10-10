// services/accounting.helpers.js
//
// Pure accounting math — no Mongoose. Trial balance, P&L, balance sheet,
// general ledger and reversal pairing all live here so they are testable
// without a database (same contract as tax.helpers.js).

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY_MS = 86400000;

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
/**
 * Accounting period ('YYYY-MM') for a document date.
 *
 * UTC, deliberately. Every date in the ledger is a UTC instant, and a tenant's
 * own month boundary is their midnight — so deriving the period with local
 * getters makes the answer depend on the server's timezone. On a UTC+1 host a
 * sale at 00:30 on 1 August is 2026-07-31T23:30Z and was filed under July,
 * quietly disagreeing with the bank statement and the month's VAT return.
 * Historical entries keep the `period` they were written with; this only
 * affects new postings.
 */
/**
 * Mongo date bounds for a `YYYY-MM` accounting period.
 *
 * UTC, for the same reason as periodOf(): a month boundary is a fixed instant,
 * and building it with `new Date(y, m-1, 1)` makes the trial balance's
 * contents depend on the server's timezone. A document stamped 23:30Z on
 * 31 July was simultaneously "July" to periodOf and inside the August trial
 * balance on a UTC+1 host.
 */
function periodRange(period) {
  const value = String(period ?? '');
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!m) {
    const err = new Error('period must be YYYY-MM');
    err.status = 400;
    throw err;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  return { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) };
}

function periodOf(date) {
  if (!date) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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

// Seeded by chartOfAccounts.service.DEFAULT_COA. These are the codes whose
// *meaning* the reports key off (the sales line, the two VAT accounts); every
// other classification comes from the Account document.
const CANONICAL_SALES = ['4000'];
const CANONICAL_TAX_COLLECTED = '2100';
const CANONICAL_TAX_PAID = '1400';
const RETAINED_EARNINGS = '3100';

/**
 * code → Account.type for a tenant, so reports classify a line the way the
 * chart of accounts says it is classified.
 *
 * Tenants create their own accounts with any code they like (coa-form-modal),
 * so a code prefix cannot be the authority: a "1500 Revenue" account and a
 * "4900 Asset" account are both reachable. The trial balance already read
 * `type` from the Account document; the P&L and balance sheet read prefixes,
 * which is how a tenant with a non-standard chart ended up with revenue on the
 * balance sheet and missing from the P&L, and a trial balance that tied to
 * neither. Returns null for codes with no Account, leaving the caller to fall
 * back to the prefix heuristic.
 */
function accountTypeResolver(accounts) {
  const byCode = new Map();
  for (const a of accounts || []) {
    if (a && a.code != null) byCode.set(String(a.code), String(a.type || ''));
  }
  const resolve = (code) => byCode.get(String(code)) || null;
  resolve.codes = byCode;
  return resolve;
}

/**
 * Which income codes are "sales" for the gross/reversals/other-income split.
 * The seeded chart separates 4000 Sales from 4100 Other Income, so the
 * canonical code wins. A tenant whose only income account is something else
 * has that account treated as sales rather than reporting no sales at all.
 */
function salesCodesFor(resolveType) {
  const income = new Set();
  for (const [code, type] of (resolveType.codes || [])) {
    if (type === 'income') income.add(code);
  }
  const canonical = CANONICAL_SALES.filter((c) => income.has(c));
  if (canonical.length) return new Set(canonical);
  if (income.size === 1) return income;
  return new Set();
}

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
  const isEmpty = list.length === 0;
  return {
    rows: list,
    totalDebits,
    totalCredits,
    // An empty period trivially agrees, but the UI must be able to say "no
    // activity" instead of "out of balance, run the backfill" — that false
    // alarm was the whole reason `balanced` used to require a positive total.
    isEmpty,
    balanced: isEmpty || Math.abs(totalDebits - totalCredits) <= 0.01,
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
 * cogs|refund) is broken out of operating expenses. Tax journal balances are reconciled against
 * the TaxRecord ledger; differences are exposed rather than silently hidden.
 */
/**
 * P&L: income − expenses over a window. COGS (account 5000 / entryTypes
 * cogs|refund) is broken out of operating expenses. Tax collected/paid come
 * from the TaxRecord summary join, not journal lines. `accounts` is the
 * tenant's chart of accounts and drives classification; omit it to fall back to
 * code prefixes.
 */
function buildProfitLoss(entries, taxSummary = {}, movementTotals = null, accounts = []) {
  return require('./accounting.report-totals').profitLossTotals(
    entries, taxSummary, movementTotals, accounts
  );
}

/**
 * Balance sheet as of a moment. Retained earnings passed in by the service
 * (= cumulative net profit across all time, simple v1 without period close).
 * `accounts` drives classification exactly as in buildProfitLoss, so a tenant
 * with a non-standard chart still sees assets = liabilities + equity.
 */
function buildBalanceSheet(entries, _asOf, retainedEarnings = 0, accounts = []) {
  const typeOf = accountTypeResolver(accounts);
  const assetsByCode = new Map();
  const liabByCode = new Map();
  const equityByCode = new Map();
  for (const entry of entries || []) {
    for (const line of entry.lines || []) {
      const code = String(line.account);
      // Metadata first; the 1/2/3 prefix split is the no-chart fallback.
      const type = typeOf(code) || (code.startsWith('1') ? 'asset' : code.startsWith('2') ? 'liability' : code.startsWith('3') ? 'equity' : null);
      const bucket =
        type === 'asset' ? assetsByCode : type === 'liability' ? liabByCode : type === 'equity' ? equityByCode : null;
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
  const retained = equityByCode.get(RETAINED_EARNINGS) || { code: RETAINED_EARNINGS, amount: 0 };
  retained.amount = round2(retained.amount + retainedEarnings);
  equityByCode.set(RETAINED_EARNINGS, retained);
  const equity = {
    rows: toRows(equityByCode),
    total: round2([...equityByCode.values()].reduce((sum, row) => sum + row.amount, 0)),
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
 *
 * Buckets by the entry's own `period` when present, else by `periodOf(date)`.
 * `period` is a denormalized field with no schema default, so a legacy or
 * hand-imported entry carries only `date` — keying off `period` alone dropped
 * those entries from the chart and every period-filtered report, which reads
 * as revenue that silently disappeared.
 */
function buildMonthlySeries(entries, endPeriod, months = 6) {
  const [ey, em] = String(endPeriod || periodOf(new Date())).split('-').map(Number);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    // UTC month arithmetic so the buckets line up with periodOf().
    const d = new Date(Date.UTC(ey, em - 1 - i, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.push({ period, label: MONTH_LABELS[d.getUTCMonth()], revenue: 0, expenses: 0 });
  }
  const byPeriod = new Map(buckets.map((b) => [b.period, b]));
  for (const entry of entries || []) {
    const bucket = byPeriod.get(String(entry.period || periodOf(entry.date)));
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

// Mirrors the JournalEntry schema enums. Held here so this module stays
// Mongoose-free; `accounting.helpers.test.js` asserts they still match the
// schema so the two cannot drift.
const ENTRY_TYPES = new Set([
  'accrued_revenue', 'sales_revenue', 'refund', 'manual', 'expense_accrual',
  'cogs', 'tax_collected', 'tax_paid', 'inventory_adjust', 'reversal',
  'customer_payment', 'vendor_payment',
]);
const ENTRY_STATUSES = new Set(['draft', 'posted']);

// refDocType is a free String on the model (document flows add their own), so it
// is only length-guarded rather than enumerated.
const REF_DOC_TYPE_RX = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const BARE_DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn a filter bound into a Date. A bare `YYYY-MM-DD` (what
 * `<input type="date">` sends) names a whole calendar day, so an upper bound
 * resolves to that day's last millisecond. Previously `new Date('2026-08-31')`
 * gave midnight UTC and `$lte` silently dropped every entry made later that day
 * — filtering "to today" hid today's own postings. A full timestamp is already
 * an exact instant and is taken as given.
 *
 * A bare date that does not round-trip (2026-02-30) is rejected rather than
 * rolled forward into March, matching dateRange() in accounting.query.js.
 */
function dateBound(value, edge) {
  if (value == null || value === '') return undefined;
  const raw = String(value);
  if (!BARE_DATE_RX.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (start.toISOString().slice(0, 10) !== raw) return undefined;
  return edge === 'end' ? new Date(start.getTime() + DAY_MS - 1) : start;
}

/**
 * Pure translation of the journal-entries list query into a Mongo filter
 * (tenant added by the caller). Unknown/invalid values are ignored rather
 * than rejected so a bad filter can never 500 the list view. `q` is a safe
 * literal contains-match over memo, source and the reference document type;
 * `account` matches line codes.
 */
function buildJournalEntryFilter(query = {}) {
  const filter = {};
  if (PERIOD_RX.test(String(query.period || ''))) filter.period = query.period;
  // A value outside the schema enum used to be passed straight into the query,
  // so a typo (?entryType=sale) returned a silently empty list instead of the
  // unfiltered one. Drop it and show everything, which is the safe default.
  if (ENTRY_TYPES.has(String(query.entryType))) filter.entryType = String(query.entryType);
  if (ENTRY_STATUSES.has(String(query.status))) filter.status = String(query.status);
  if (REF_DOC_TYPE_RX.test(String(query.refDocType || ''))) filter.refDocType = String(query.refDocType);
  if (query.account) filter['lines.account'] = String(query.account).trim();
  if (query.from || query.to) {
    filter.date = {};
    const from = dateBound(query.from, 'start');
    const to = dateBound(query.to, 'end');
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
    if (!Object.keys(filter.date).length) delete filter.date;
  }
  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ memo: rx }, { source: rx }, { refDocType: rx }];
  }
  return filter;
}

module.exports = {
  round2,
  normalizeLines,
  isBalanced,
  periodOf,
  periodRange,
  accountTypeResolver,
  salesCodesFor,
  dateBound,
  CANONICAL_SALES,
  CANONICAL_TAX_COLLECTED,
  CANONICAL_TAX_PAID,
  RETAINED_EARNINGS,
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
