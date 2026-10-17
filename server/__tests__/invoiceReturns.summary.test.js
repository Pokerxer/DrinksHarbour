const test = require("node:test");
const assert = require("node:assert/strict");
test("invoice header totals use saved net balances and do not add POS tabs twice", () => {
  const {
    summarizeSavedInvoices,
  } = require("../services/customerInvoice/summary");
  const rows = [
    {
      state: "posted",
      currency: "NGN",
      source: "sales",
      outstanding: 20,
      date: "2026-10-14",
    },
    {
      state: "posted",
      currency: "NGN",
      source: "pos",
      outstanding: 40,
      date: "2026-10-14",
    },
    { state: "cancelled", outstanding: 100, date: "2026-10-14" },
    { state: "draft", outstanding: 100, date: "2026-10-14" },
  ];
  const summary = summarizeSavedInvoices(rows, new Date("2026-10-14"));
  assert.equal(summary.totalOutstanding, 60);
  assert.equal(summary.count, 2);
  assert.equal(summary.onAccount, 40);
  assert.equal(summary.buckets.current, 60);
});
test('invoice summary exposes unverified draft balances instead of silently implying no outstanding', () => {
  const { summarizeSavedInvoices } = require('../services/customerInvoice/summary');
  const summary = summarizeSavedInvoices([
    { state: 'posted', currency: 'NGN', outstanding: 0 },
    { state: 'draft', currency: 'NGN', outstanding: 2091492.48, reconciliationIssue: 'Missing revenue' },
    { state: 'draft', currency: 'NGN', outstanding: 119754, reconciliationIssue: 'Payment mismatch' },
    { state: 'draft', currency: 'NGN', outstanding: 1716469.2, reconciliationIssue: 'Payment mismatch' },
    { state: 'draft', currency: 'NGN', outstanding: 0, reconciliationIssue: 'Missing revenue' },
    { state: 'draft', currency: 'NGN', outstanding: 500 },
    { state: 'cancelled', currency: 'NGN', outstanding: 100, reconciliationIssue: 'Cancelled' },
    { state: 'draft', currency: 'USD', outstanding: 900, reconciliationIssue: 'Currency' },
  ]);
  assert.equal(summary.totalOutstanding, 0);
  assert.equal(summary.count, 0);
  assert.equal(summary.reviewCount, 4);
  assert.equal(summary.reviewBalanceCount, 3);
  assert.equal(summary.reviewOutstanding, 3927715.68);
  assert.equal(summary.buckets.current, 0);
});
