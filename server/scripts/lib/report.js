// scripts/lib/report.js
//
// Aggregates per-customer outcomes and writes a JSON report + a console summary.
// One responsibility per method; the orchestrator drives it.

const fs = require('fs');
const path = require('path');

/**
 * @returns {object} an empty report ready to accumulate into.
 */
function newReport({ apiUrl, options }) {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    apiUrl,
    options,
    customers: [],   // { email, ordersPlaced, itemsPurchased, reviewsLeft, totalSpent, errors }
    errors: [],      // top-level errors not attached to a specific customer
    summary: null,   // filled in by finalize()
  };
}

function recordCustomer(report, entry) {
  report.customers.push({
    email:            entry.email,
    userId:           entry.userId || null,
    ordersPlaced:     entry.ordersPlaced || 0,
    itemsPurchased:   entry.itemsPurchased || 0,
    reviewsLeft:      entry.reviewsLeft || 0,
    reviewsApproved:  entry.reviewsApproved || 0,
    totalSpent:       Math.round((entry.totalSpent || 0) * 100) / 100,
    ordersDelivered:  entry.ordersDelivered || 0,
    ordersPaid:       entry.ordersPaid || 0,
    errors:           entry.errors || [],
  });
}

function recordError(report, err) {
  report.errors.push({
    at: new Date().toISOString(),
    message: err?.message || String(err),
    status: err?.status || null,
    path: err?.path || null,
  });
}

function finalize(report) {
  const totals = report.customers.reduce(
    (acc, c) => {
      acc.customers += 1;
      acc.orders += c.ordersPlaced;
      acc.delivered += c.ordersDelivered;
      acc.paid += c.ordersPaid;
      acc.items += c.itemsPurchased;
      acc.reviews += c.reviewsLeft;
      acc.reviewsApproved += c.reviewsApproved;
      acc.gmv += c.totalSpent;
      return acc;
    },
    { customers: 0, orders: 0, delivered: 0, paid: 0, items: 0, reviews: 0, reviewsApproved: 0, gmv: 0 },
  );
  totals.gmv = Math.round(totals.gmv * 100) / 100;

  report.finishedAt = new Date().toISOString();
  report.summary = { ...totals, errorCount: report.errors.length };
  return report;
}

/**
 * Write the report to server/scripts/seed-output/purchase-review-<ts>.json.
 * @returns {string|null} the file path, or null if dryRun.
 */
function writeReport(report, { dryRun = false } = {}) {
  if (dryRun) return null;
  const outDir = path.resolve(__dirname, '..', 'seed-output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `purchase-review-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

function printConsoleSummary(report, log = console.log) {
  const s = report.summary || {};
  log('\n──────── Purchase Seed Summary ────────');
  log(`Customers created / reused:  ${s.customers}`);
  log(`Orders placed:               ${s.orders}`);
  log(`Orders advanced to delivered ${s.delivered}`);
  log(`Orders marked paid:          ${s.paid}`);
  log(`Line items purchased:        ${s.items}`);
  log(`Reviews submitted:           ${s.reviews}`);
  log(`Reviews approved:            ${s.reviewsApproved}`);
  log(`Approximate GMV:             ₦${(s.gmv || 0).toLocaleString()}`);
  log(`Errors:                      ${s.errorCount}`);
  log('───────────────────────────────────────');
  if (report.errors.length) {
    log('\nTop-level errors:');
    for (const e of report.errors.slice(0, 10)) {
      log(`  · ${e.status ?? '—'} ${e.path ?? ''} ${e.message}`);
    }
    if (report.errors.length > 10) log(`  … and ${report.errors.length - 10} more.`);
  }
}

module.exports = {
  newReport,
  recordCustomer,
  recordError,
  finalize,
  writeReport,
  printConsoleSummary,
};
