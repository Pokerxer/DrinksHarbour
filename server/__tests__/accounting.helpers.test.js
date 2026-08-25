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
  buildProfitLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  sumMovementCosts,
  buildMonthlySeries,
  nextDocNumber,
  agingBucket,
  validateAllocations,
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
