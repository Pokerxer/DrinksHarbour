// __tests__/accounting.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  round2,
  isBalanced,
  normalizeLines,
  periodOf,
  swapLinesForReversal,
  buildTrialBalance,
  periodRange,
  buildProfitLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  sumMovementCosts,
  buildMonthlySeries,
  nextDocNumber,
  agingBucket,
  validateAllocations,
  buildJournalEntryFilter,
} = require('../services/accounting.helpers');

const ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1300', name: 'Receivables', type: 'asset' },
  { code: '2000', name: 'Payables', type: 'liability' },
  { code: '2100', name: 'Tax Collected', type: 'liability' },
  { code: '3100', name: 'Retained Earnings', type: 'equity' },
  { code: '4000', name: 'Sales Revenue', type: 'income' },
  { code: '5000', name: 'COGS', type: 'expense' },
  { code: '6000', name: 'Operating Expenses', type: 'expense' },
];

test('round2 keeps kobo precision', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2('x'), 0);
});

test('isBalanced enforces double-entry within ±0.01 and non-zero', () => {
  assert.equal(isBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }]), true);
  assert.equal(isBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 99.995 }]), true);
  assert.equal(isBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 99 }]), false);
  assert.equal(isBalanced([{ debit: 0, credit: 0 }]), false);
});

test('normalizeLines rounds and coerces accounts', () => {
  const lines = normalizeLines([
    { account: ' 4000 ', debit: '50.004', credit: 0, memo: 'm' },
    { account: '1000', debit: 0, credit: 0 },
  ]);
  assert.deepEqual(lines[0], { account: '4000', accountId: undefined, debit: 50, credit: 0, memo: 'm' });
  assert.equal(lines[1].debit, 0);
});

test('periodOf formats YYYY-MM', () => {
  assert.equal(periodOf(new Date('2026-08-05T10:00:00Z')), '2026-08');
  assert.equal(periodOf(undefined), undefined);
});

test('swapLinesForReversal flips sides and prefixes memo', () => {
  const entry = {
    lines: [{ account: '1000', debit: 500, credit: 0 }, { account: '4000', debit: 0, credit: 500 }],
    memo: 'SO-1 revenue',
  };
  const swapped = swapLinesForReversal(entry);
  assert.equal(swapped.lines[0].account, '1000');
  assert.equal(swapped.lines[0].credit, 500);
  assert.equal(swapped.lines[0].debit, 0);
  assert.equal(swapped.lines[1].debit, 500);
  assert.match(swapped.memo, /^Reversal of SO-1 revenue$/);
});

test('buildTrialBalance totals per account and flags balance', () => {
  const entries = [
    { lines: [{ account: '1300', debit: 1075, credit: 0 }, { account: '4000', debit: 0, credit: 1000 }, { account: '2100', debit: 0, credit: 75 }] },
    { lines: [{ account: '6000', debit: 300, credit: 0 }, { account: '1000', debit: 0, credit: 300 }] },
  ];
  const tb = buildTrialBalance(entries, ACCOUNTS);
  assert.equal(tb.totalDebits, 1375);
  assert.equal(tb.totalCredits, 1375);
  assert.equal(tb.balanced, true);
  const cash = tb.rows.find((r) => r.code === '1000');
  assert.equal(cash.closing, -300); // asset closing = debits − credits
  const sales = tb.rows.find((r) => r.code === '4000');
  assert.equal(sales.closing, 1000); // income closing = credits − debits
  assert.equal(sales.type, 'income');
});

test('buildProfitLoss groups income/expense with COGS breakout and tax lines', () => {
  const entries = [
    { lines: [{ account: '1300', debit: 1075, credit: 0 }, { account: '4000', debit: 0, credit: 1000 }, { account: '2100', debit: 0, credit: 75 }] },
    { lines: [{ account: '5000', debit: 400, credit: 0 }, { account: '1200', debit: 0, credit: 400 }] },
    { lines: [{ account: '6000', debit: 150, credit: 0 }, { account: '1000', debit: 0, credit: 150 }] },
  ];
  // The input VAT summary must have a matching journal asset movement.
  entries.push({ lines: [{ account: '1400', debit: 20, credit: 0 }, { account: '1000', debit: 0, credit: 20 }] });
  const pl = buildProfitLoss(entries, { collected: 75, paid: 20 });
  assert.equal(pl.revenueTotal, 1000);
  assert.equal(pl.cogs.total, 400);
  assert.equal(pl.expenseTotal, 150);
  assert.equal(pl.netProfit, 450);
  assert.equal(pl.tax.collected, 75);
  assert.equal(pl.tax.paid, 20);
});

test('buildBalanceSheet sections with retained earnings and balance flag', () => {
  const entries = [
    // Sale on credit
    { lines: [{ account: '1300', debit: 1075, credit: 0 }, { account: '4000', debit: 0, credit: 1000 }, { account: '2100', debit: 0, credit: 75 }] },
    // Expense paid cash
    { lines: [{ account: '6000', debit: 150, credit: 0 }, { account: '1000', debit: 0, credit: 150 }] },
  ];
  const bs = buildBalanceSheet(entries, new Date(), 850);
  const receivables = bs.assets.rows.find((r) => r.code === '1300');
  assert.equal(receivables.amount, 1075);
  assert.equal(bs.liabilities.total, 75);
  const re = bs.equity.rows.find((r) => r.code === '3100');
  assert.equal(re.amount, 850);
  assert.equal(bs.balanced, true); // assets 925 = liab 75 + equity 850
});

test('buildGeneralLedger produces a running balance', () => {
  const entries = [
    { date: '2026-08-02T00:00:00Z', memo: 'b', lines: [{ account: '1000', debit: 200, credit: 0 }] },
    { date: '2026-08-01T00:00:00Z', memo: 'a', lines: [{ account: '1000', debit: 100, credit: 0 }] },
    { date: '2026-08-03T00:00:00Z', memo: 'c', lines: [{ account: '1000', debit: 0, credit: 50 }] },
  ];
  const gl = buildGeneralLedger(entries, '1000');
  assert.equal(gl.lines.length, 3);
  assert.equal(gl.lines[0].balance, 100); // sorted by date asc
  assert.equal(gl.lines[2].balance, 250);
  assert.equal(gl.totals.debits, 300);
  assert.equal(gl.totals.credits, 50);
});

test('buildGeneralLedger honours credit nature and opening balance', () => {
  const entries = [
    { date: '2026-08-01T00:00:00Z', lines: [{ account: '4000', debit: 0, credit: 500 }] },
    { date: '2026-08-02T00:00:00Z', lines: [{ account: '4000', debit: 100, credit: 0 }] }, // credit note
  ];
  const income = buildGeneralLedger(entries, '4000', { creditNature: true });
  assert.deepEqual(
    income.lines.map((l) => l.balance),
    [500, 400] // credits grow the balance; a debit shrinks it
  );
  const withOpening = buildGeneralLedger([entries[1]], '4000', {
    openingBalance: 1200,
    creditNature: true,
  });
  assert.equal(withOpening.openingBalance, 1200);
  assert.equal(withOpening.lines[0].balance, 1100);
  assert.equal(withOpening.totals.closing, 1100);
});

test('sumMovementCosts splits outbound COGS from losses', () => {
  const movements = [
    { type: 'sold', quantity: 2, unitCost: 100, totalCost: 200 },
    { type: 'shipped', quantity: 1, unitCost: 50 },
    { type: 'damaged', quantity: 1, unitCost: 30 },
    { type: 'received', quantity: 5, unitCost: 40 },
  ];
  const sums = sumMovementCosts(movements);
  assert.equal(sums.cogs, 250);
  assert.equal(sums.losses, 30);
});

test('buildMonthlySeries buckets revenue/expenses per period', () => {
  const entries = [
    { period: '2026-07', lines: [{ account: '4000', debit: 0, credit: 500 }, { account: '1300', debit: 500, credit: 0 }] },
    { period: '2026-08', lines: [{ account: '6000', debit: 120, credit: 0 }, { account: '1000', debit: 0, credit: 120 }] },
    { period: '2026-08', lines: [{ account: '4000', debit: 0, credit: 800 }, { account: '2100', debit: 0, credit: 60 }] },
    { period: undefined, lines: [] }, // skipped
  ];
  const series = buildMonthlySeries(entries, '2026-08');
  assert.equal(series.length, 6); // padded back to Jan..Aug window
  const jul = series.find((p) => p.period === '2026-07');
  assert.deepEqual(jul, { period: '2026-07', label: 'Jul', revenue: 500, expenses: 0 });
  const aug = series.find((p) => p.period === '2026-08');
  assert.deepEqual(aug, { period: '2026-08', label: 'Aug', revenue: 800, expenses: 120 });
});

test('nextDocNumber pads per-tenant sequence with year', () => {
  assert.equal(nextDocNumber('CN', 0, 2026), 'CN-2026-0001');
  assert.equal(nextDocNumber('VPAY', 41, 2026), 'VPAY-2026-0042');
});

test('agingBucket buckets by days outstanding', () => {
  assert.equal(agingBucket(5), 'current');
  assert.equal(agingBucket(30), '16-30');
  assert.equal(agingBucket(45), '31-60');
  assert.equal(agingBucket(75), '61-90');
  assert.equal(agingBucket(120), '90+');
});

test('validateAllocations rejects over-allocation and unknown docs', () => {
  const outstanding = { so1: 500, so2: 200 };
  assert.deepEqual(
    validateAllocations({ amount: 600, allocations: [{ docId: 'so1', amount: 400 }, { docId: 'so2', amount: 200 }], outstandingByDoc: outstanding }).errors,
    []
  );
  const over = validateAllocations({ amount: 500, allocations: [{ docId: 'so1', amount: 400 }, { docId: 'so2', amount: 200 }], outstandingByDoc: outstanding });
  assert.match(over.errors[0], /exceed payment amount/);
  const perDoc = validateAllocations({ amount: 900, allocations: [{ docId: 'so1', amount: 600 }], outstandingByDoc: outstanding });
  assert.match(perDoc.errors[0], /outstanding balance/);
  const unknown = validateAllocations({ amount: 100, allocations: [{ docId: 'nope', amount: 100 }], outstandingByDoc: outstanding });
  assert.match(unknown.errors[0], /not found/);
});

test('buildJournalEntryFilter maps valid query params and ignores junk', () => {
  const filter = buildJournalEntryFilter({
    period: '2026-08',
    entryType: 'manual',
    status: 'posted',
    account: ' 4000 ',
    from: '2026-08-01',
    to: '2026-08-31',
    q: 'stock',
  });
  assert.equal(filter.period, '2026-08');
  assert.equal(filter.entryType, 'manual');
  assert.equal(filter.status, 'posted');
  assert.equal(filter['lines.account'], '4000');
  assert.ok(filter.date.$gte instanceof Date);
  assert.ok(filter.date.$lte instanceof Date);
  assert.equal(filter.$or.length, 3);

  const junk = buildJournalEntryFilter({ period: 'aug-2026', q: '(.*', from: 'nope' });
  assert.deepEqual(junk, {
    $or: [{ memo: /\(\.\*/i }, { source: /\(\.\*/i }, { refDocType: /\(\.\*/i }],
  });
  assert.deepEqual(buildJournalEntryFilter({}), {});
});

// ── Audit: /accounting/journal-entries ───────────────────────────────────────

test('journal filter treats `to` as inclusive of the whole final day', () => {
  // A bare YYYY-MM-DD from <input type="date"> parses to midnight UTC, so
  // `$lte` that instant silently dropped every entry made later that day.
  const filter = buildJournalEntryFilter({ from: '2026-08-01', to: '2026-08-31' });
  assert.equal(filter.date.$lte.getTime(), Date.UTC(2026, 7, 31, 23, 59, 59, 999));

  // A day AFTER the to-date must still be excluded (no over-capture).
  const boundary = buildJournalEntryFilter({ to: '2026-08-31' });
  assert.ok(boundary.date.$lte.getTime() > Date.UTC(2026, 7, 31, 12, 0, 0));
  assert.ok(boundary.date.$lte.getTime() < Date.UTC(2026, 8, 1, 0, 0, 0));
});

test('journal filter keeps a full timestamp `to` as given', () => {
  const explicit = buildJournalEntryFilter({ to: '2026-08-31T09:30:00.000Z' });
  assert.equal(explicit.date.$lte.toISOString(), '2026-08-31T09:30:00.000Z');
});

test('journal filter drops enum values outside the schema instead of injecting them', () => {
  // The contract in the docblock is "invalid values are ignored, never 500".
  // Injecting them verbatim turned a typo into a silent empty list.
  const filter = buildJournalEntryFilter({
    entryType: 'not_a_type',
    status: 'archived',
  });
  assert.equal(filter.entryType, undefined);
  assert.equal(filter.status, undefined);

  const valid = buildJournalEntryFilter({
    entryType: 'reversal',
    status: 'draft',
    refDocType: 'Manual',
  });
  assert.equal(valid.entryType, 'reversal');
  assert.equal(valid.status, 'draft');
  assert.equal(valid.refDocType, 'Manual');
});

test('journal filter shape-guards the free-form refDocType', () => {
  // refDocType is an open String on the schema (each document flow adds its
  // own), so identifiers must pass — but not an empty or operator-looking one.
  assert.equal(buildJournalEntryFilter({ refDocType: 'VendorBill' }).refDocType, 'VendorBill');
  assert.equal(buildJournalEntryFilter({ refDocType: 'OrderRefund' }).refDocType, 'OrderRefund');
  for (const bad of ['', '   ', '$ne', 'has space', 'x'.repeat(41), '1leading']) {
    assert.equal(
      buildJournalEntryFilter({ refDocType: bad }).refDocType,
      undefined,
      `expected ${JSON.stringify(bad)} to be rejected`
    );
  }
});

test('monthly series buckets entries whose `period` was never denormalized', () => {
  // `period` has no schema default, so a legacy/hand-written entry carries only
  // `date`. Those entries used to vanish from the dashboard chart entirely.
  const entries = [
    { date: '2026-03-15T12:00:00Z', lines: [{ account: '4000', debit: 0, credit: 500 }] },
    { period: '2026-03', date: '2026-03-20T12:00:00Z', lines: [{ account: '6000', debit: 200, credit: 0 }] },
  ];
  const series = buildMonthlySeries(entries, '2026-03', 3);
  const march = series.find((b) => b.period === '2026-03');
  assert.equal(march.revenue, 500);
  assert.equal(march.expenses, 200);
});

test('monthly series prefers a stored `period` over the date', () => {
  // Backdated postings keep their own period when one is present.
  const entries = [
    { period: '2026-01', date: '2026-03-05T00:00:00Z', lines: [{ account: '4000', debit: 0, credit: 100 }] },
  ];
  const series = buildMonthlySeries(entries, '2026-03', 3);
  assert.equal(series.find((b) => b.period === '2026-01').revenue, 100);
  assert.equal(series.find((b) => b.period === '2026-03').revenue, 0);
});

test('filter enums stay in sync with the JournalEntry schema', () => {
  // The helper keeps its own copies so it stays Mongoose-free. This is the
  // tripwire: if the schema gains or drops an entry type, this fails and the
  // copies get updated rather than silently rejecting a valid filter.
  const schema = require('../models/JournalEntry').schema;
  const enumOf = (path) => {
    const values = schema.path(path).enumValues;
    assert.ok(Array.isArray(values), `${path} has no enumValues on the schema`);
    return values;
  };

  const accepted = new Set(
    Array.from({ length: enumOf('entryType').length }, (_, i) =>
      buildJournalEntryFilter({ entryType: enumOf('entryType')[i] }).entryType)
  );
  for (const type of enumOf('entryType')) {
    assert.equal(accepted.has(type), true, `filter rejects schema entryType "${type}"`);
  }
  for (const status of enumOf('status')) {
    assert.equal(buildJournalEntryFilter({ status }).status, status);
  }
});

test('journal filter rejects a bare date that does not exist', () => {
  // 2026-02-30 would otherwise roll forward into March and quietly return a
  // March window for a February filter.
  assert.equal(buildJournalEntryFilter({ to: '2026-02-30' }).date, undefined);
  assert.equal(buildJournalEntryFilter({ from: '2026-13-01' }).date, undefined);
  assert.ok(buildJournalEntryFilter({ to: '2028-02-29' }).date.$lte instanceof Date); // leap year
});

// ── Account classification: metadata first, code prefix only as a fallback ────

// A tenant may create accounts with any code (`coa-form-modal`), so the code
// prefix cannot be the authority. A revenue account numbered 1500 and an asset
// numbered 4900 are both reachable through the UI.
const MIXED_COA = [
  { code: '1500', name: 'Bottle Shop Revenue', type: 'income' },
  { code: '4900', name: 'Keg Deposit Asset', type: 'asset' },
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '2100', name: 'VAT Output', type: 'liability' },
  { code: '5500', name: 'Cider COGS', type: 'expense' },
  { code: '6900', name: 'Rent', type: 'expense' },
];

const MIXED_ENTRIES = [
  // Sale credited to the 1500 revenue account; cash received.
  { entryType: 'sales_revenue', lines: [
    { account: '1000', debit: 1150, credit: 0 },
    { account: '1500', debit: 0, credit: 1000 },
    { account: '2100', debit: 0, credit: 150 },
  ] },
  // Keg deposit is an asset the tenant holds (a 4900 code that looks like revenue).
  { entryType: 'manual', lines: [
    { account: '1000', debit: 0, credit: 200 },
    { account: '4900', debit: 200, credit: 0 },
  ] },
  // Costs on non-canonical expense codes, paid from cash.
  { entryType: 'manual', lines: [
    { account: '5500', debit: 400, credit: 0 },
    { account: '6900', debit: 100, credit: 0 },
    { account: '1000', debit: 0, credit: 500 },
  ] },
];

test('profit and loss classifies by Account.type, not by code prefix', () => {
  const pl = buildProfitLoss(MIXED_ENTRIES, {}, null, MIXED_COA);
  // 1000 of real revenue, NOT 1200 (the 4900 keg deposit is an asset).
  assert.equal(pl.revenueTotal, 1000);
  // 400 of COGS from 5500, 100 of operating expense from 6900.
  assert.equal(pl.cogs.total, 400);
  assert.equal(pl.expenseTotal, 100);
  assert.equal(pl.grossProfit, 600);
  assert.equal(pl.netProfit, 500);
});

test('balance sheet classifies by Account.type, not by code prefix', () => {
  const lifetime = buildProfitLoss(MIXED_ENTRIES, {}, null, MIXED_COA);
  const bs = buildBalanceSheet(MIXED_ENTRIES, new Date(), lifetime.netProfit, MIXED_COA);
  // Cash 450 + keg deposit 200. The 1500 revenue account must not be filed here.
  assert.equal(bs.assets.total, 650);
  assert.ok(!bs.assets.rows.some((r) => r.code === '1500'), 'revenue account filed as an asset');
  assert.ok(bs.assets.rows.some((r) => r.code === '4900'), 'asset with a 4xxx code missing from assets');
  // VAT output 150, and net profit 500 lands in retained earnings.
  assert.equal(bs.liabilities.total, 150);
  assert.equal(bs.equity.total, 500);
  assert.equal(bs.balanced, true, 'assets 650 must equal liabilities 150 + equity 500');
});

test('profit and loss and the trial balance agree on every account type', () => {
  // The reconciliation a bookkeeper actually performs: the trial balance is
  // built from Account.type, so the P&L must classify identically or the two
  // reports can never tie out.
  const tb = buildTrialBalance(MIXED_ENTRIES, MIXED_COA);
  const incomeFromTb = tb.rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.closing, 0);
  const pl = buildProfitLoss(MIXED_ENTRIES, {}, null, MIXED_COA);
  assert.equal(pl.revenueTotal, incomeFromTb);

  const assetsFromTb = tb.rows.filter((r) => r.type === 'asset').reduce((s, r) => s + r.closing, 0);
  const bs = buildBalanceSheet(MIXED_ENTRIES, new Date(), pl.netProfit, MIXED_COA);
  assert.equal(bs.assets.total, assetsFromTb);
});

test('canonical-code reports still fall back to prefixes with no Account metadata', () => {
  // Before a tenant's chart is loaded (or for a legacy entry with an account
  // that has since been deleted) the prefix heuristic must still classify.
  const pl = buildProfitLoss([
    { entryType: 'manual', lines: [
      { account: '1000', debit: 500, credit: 0 },
      { account: '4000', debit: 0, credit: 400 },
      { account: '5000', debit: 60, credit: 0 },
    ] },
  ], {}, null, []);
  assert.equal(pl.revenueTotal, 400);
  assert.equal(pl.cogs.total, 60);
  assert.equal(pl.netProfit, 340);
});

// ── Period attribution: dates are UTC instants, so periods must be too ───────

test('periodOf derives the period in UTC, not the server timezone', () => {
  // Tenant is UTC+1 (Lagos). A sale at 00:30 local on 1 August is
  // 2026-07-31T23:30Z. Deriving the period with local getters on a server
  // running UTC files it under July, so the month's VAT and revenue totals
  // disagree with the bank statement and the FIRS return.
  assert.equal(periodOf('2026-07-31T23:30:00Z'), '2026-07');
  assert.equal(periodOf('2026-08-01T00:30:00Z'), '2026-08');
  assert.equal(periodOf('2026-01-01T00:00:00Z'), '2026-01'); // year boundary
  assert.equal(periodOf('2026-12-31T23:59:59Z'), '2026-12');
  assert.equal(periodOf(null), undefined);
  assert.equal(periodOf('nonsense'), undefined);
});

test('period is derived consistently with the series buckets', () => {
  // periodOf and buildMonthlySeries must agree, or an entry written at the very
  // start of a month lands in a bucket the chart never renders.
  const series = buildMonthlySeries([], '2026-08', 3);
  const periods = series.map((b) => b.period);
  assert.deepEqual(periods, ['2026-06', '2026-07', '2026-08']);
  const boundary = { date: '2026-08-01T00:30:00Z', lines: [{ account: '4000', credit: 100, debit: 0 }] };
  assert.equal(periodOf(boundary.date), '2026-08');
  assert.equal(buildMonthlySeries([boundary], '2026-08', 3).find((b) => b.period === '2026-08').revenue, 100);
});

// ── Trial balance: an empty period is not an imbalance ───────────────────────

test('trial balance reports an empty period as empty, not out of balance', () => {
  // `balanced` required totalDebits > 0 so that an empty set was not called
  // "balanced" — but the UI reads !balanced as "out of balance" and told the
  // user to run the journal backfill for a month with simply no activity, at
  // ₦0.00 vs ₦0.00. It also answered HTTP 207 for a perfectly valid report.
  const tb = buildTrialBalance([], []);
  assert.equal(tb.rows.length, 0);
  assert.equal(tb.totalDebits, 0);
  assert.equal(tb.totalCredits, 0);
  assert.equal(tb.isEmpty, true, 'an empty period must be distinguishable from an imbalance');
  assert.equal(tb.balanced, true, 'debits do equal credits, there is simply nothing posted');
});

test('trial balance is not "empty" merely because its first account netted to zero', () => {
  // A posting of 100 to two sides nets the first code to zero; the period still
  // has activity and a real closing figure to show.
  const tb = buildTrialBalance(
    [{ entryType: 'manual', lines: [{ account: '1000', debit: 100, credit: 0 }] }],
    [{ code: '1000', name: 'Cash', type: 'asset' }]
  );
  assert.equal(tb.isEmpty, false);
  assert.equal(tb.balanced, false, '100 debits vs 0 credits is a genuine imbalance');
});

// ── Period → date range: month boundaries must not depend on the host TZ ─────

test('periodRange bounds a month in UTC, matching periodOf', () => {
  // The trial balance filtered on a *local* month range while periodOf() and the
  // monthly series bucket in UTC. On a UTC+1 host, a document stamped
  // 2026-07-31T23:30Z was filed under July by periodOf but appeared in the
  // AUGUST trial balance — the two reports disagreed about the same entry, and
  // which answer you got depended on the server's timezone.
  const { $gte, $lt } = periodRange('2026-08');
  assert.equal($gte.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal($lt.toISOString(), '2026-09-01T00:00:00.000Z');

  const lateJuly = new Date('2026-07-31T23:30:00Z');
  assert.equal(periodOf(lateJuly), '2026-07');
  assert.ok(!(lateJuly >= $gte && lateJuly < $lt), 'must not appear in the August trial balance');

  const earlyAug = new Date('2026-08-01T00:30:00Z');
  assert.equal(periodOf(earlyAug), '2026-08');
  assert.ok(earlyAug >= $gte && earlyAug < $lt, 'must appear in the August trial balance');
});

test('periodRange handles month and year edges and rejects junk', () => {
  assert.equal(periodRange('2026-12').$lt.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(periodRange('2026-01').$gte.toISOString(), '2026-01-01T00:00:00.000Z');
  for (const bad of ['2026-13', '2026-00', 'nonsense', '', '26-08']) {
    assert.throws(() => periodRange(bad), /YYYY-MM/, `expected ${bad} to be rejected`);
  }
});
