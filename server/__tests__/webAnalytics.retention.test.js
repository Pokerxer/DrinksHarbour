// __tests__/webAnalytics.retention.test.js
//
// Retention used to be derived from repeat customer orders: "expansions" were
// customers placing a second order, and "cancellations" counted every customer
// whose last order was over 60 days old — recomputed for each day of the window,
// so the line was near-constant and the summary reported all-time lapsed
// customers rather than churn in the period. It is now built from the
// SubscriptionEvent ledger.
const test = require('node:test');
const assert = require('node:assert');
const { bucketRetention } = require('../services/webAnalytics.service');

const ev = (kind, day) => ({ kind, effectiveAt: `${day}T09:00:00.000Z` });

test('buckets expansions and cancellations per day, oldest first', () => {
  const out = bucketRetention([
    ev('expansion', '2026-08-02'),
    ev('expansion', '2026-08-01'),
    ev('expansion', '2026-08-01'),
    ev('cancellation', '2026-08-03'),
  ]);
  assert.deepEqual(out.data, [
    { day: '2026-08-01', expansions: 2, cancellations: 0 },
    { day: '2026-08-02', expansions: 1, cancellations: 0 },
    { day: '2026-08-03', expansions: 0, cancellations: 1 },
  ]);
  assert.deepEqual(out.summary, { expansions: 3, cancellations: 1 });
});

test('a downgrade is not churn', () => {
  const out = bucketRetention([ev('contraction', '2026-08-01')]);
  assert.equal(out.summary.cancellations, 0, 'a tenant choosing to shrink has not cancelled');
});

test('a failed payment is not churn either', () => {
  const out = bucketRetention([ev('payment_failure', '2026-08-01')]);
  assert.equal(out.summary.cancellations, 0, 'a failed payment is recoverable and dunning owns it');
});

test('the summary counts events in the window, not all-time lapsed customers', () => {
  // The old implementation returned a count of every customer in the database
  // whose last order was 60+ days old, which grew with total customers rather
  // than with churn.
  const out = bucketRetention([ev('cancellation', '2026-08-01')]);
  assert.equal(out.summary.cancellations, 1);
});

test('an empty ledger yields an empty series, never invented zeros', () => {
  const out = bucketRetention([]);
  assert.deepEqual(out.data, []);
  assert.deepEqual(out.summary, { expansions: 0, cancellations: 0 });
});

test('days are UTC dates, so the series buckets consistently', () => {
  const out = bucketRetention([
    { kind: 'expansion', effectiveAt: '2026-08-01T23:30:00.000Z' },
    { kind: 'expansion', effectiveAt: '2026-08-02T00:30:00.000Z' },
  ]);
  assert.deepEqual(out.data.map((d) => d.day), ['2026-08-01', '2026-08-02']);
});
