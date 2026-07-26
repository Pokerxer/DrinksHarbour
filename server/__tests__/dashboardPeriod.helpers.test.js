const test = require('node:test');
const assert = require('node:assert');
const { resolvePeriod, PERIOD_KEYS } = require('../services/dashboardPeriod.helpers');

// Fixed reference point: Wed 15 Jul 2026, 13:45 local time.
const NOW = new Date(2026, 6, 15, 13, 45, 0, 0);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('exports the seven supported period keys', () => {
  assert.deepStrictEqual(PERIOD_KEYS, ['today', '7d', '30d', 'month', 'quarter', 'year', 'custom']);
});

test('defaults to month and reproduces calendar-month boundaries', () => {
  const p = resolvePeriod({}, NOW);
  assert.strictEqual(p.key, 'month');
  assert.strictEqual(iso(p.rangeStart), '2026-07-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-31');
  assert.strictEqual(p.rangeStart.getHours(), 0);
  assert.strictEqual(p.rangeEnd.getHours(), 23);
  // month compares to the previous calendar month
  assert.strictEqual(iso(p.prevStart), '2026-06-01');
  assert.strictEqual(iso(p.prevEnd), '2026-06-30');
});

test('today compares to yesterday', () => {
  const p = resolvePeriod({ period: 'today' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-15');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-07-14');
  assert.strictEqual(iso(p.prevEnd), '2026-07-14');
});

test('7d is an inclusive 7-day window ending today, compared to the prior 7 days', () => {
  const p = resolvePeriod({ period: '7d' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-09');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-07-02');
  assert.strictEqual(iso(p.prevEnd), '2026-07-08');
});

test('30d is an inclusive 30-day window ending today', () => {
  const p = resolvePeriod({ period: '30d' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-06-16');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-05-17');
  assert.strictEqual(iso(p.prevEnd), '2026-06-15');
});

test('quarter uses calendar quarters and compares to the previous quarter', () => {
  const p = resolvePeriod({ period: 'quarter' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-09-30');
  assert.strictEqual(iso(p.prevStart), '2026-04-01');
  assert.strictEqual(iso(p.prevEnd), '2026-06-30');
});

test('year uses the calendar year and compares to the previous year', () => {
  const p = resolvePeriod({ period: 'year' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-01-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-12-31');
  assert.strictEqual(iso(p.prevStart), '2025-01-01');
  assert.strictEqual(iso(p.prevEnd), '2025-12-31');
});

test('custom honours an explicit from/to range', () => {
  const p = resolvePeriod({ period: 'custom', from: '2026-03-01', to: '2026-03-10' }, NOW);
  assert.strictEqual(p.key, 'custom');
  assert.strictEqual(iso(p.rangeStart), '2026-03-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
  // previous window of equal length, ending the day before rangeStart
  assert.strictEqual(iso(p.prevEnd), '2026-02-28');
  assert.strictEqual(iso(p.prevStart), '2026-02-19');
});

test('custom swaps a reversed range', () => {
  const p = resolvePeriod({ period: 'custom', from: '2026-03-10', to: '2026-03-01' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-03-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
});

test('custom clamps a range longer than 366 days', () => {
  const p = resolvePeriod({ period: 'custom', from: '2020-01-01', to: '2026-03-10' }, NOW);
  const days = Math.round((p.rangeEnd - p.rangeStart) / 86400000);
  assert.ok(days <= 366, `expected <= 366 days, got ${days}`);
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
});

test('degrades to month rather than throwing on bad input', () => {
  const monthStart = iso(resolvePeriod({}, NOW).rangeStart);
  for (const bad of [
    { period: 'nonsense' },
    { period: 'custom' },
    { period: 'custom', from: 'not-a-date', to: 'also-bad' },
    { period: 'custom', from: '2026-03-01' },
    { period: null },
  ]) {
    const p = resolvePeriod(bad, NOW);
    assert.strictEqual(p.key, 'month', `expected month fallback for ${JSON.stringify(bad)}`);
    assert.strictEqual(iso(p.rangeStart), monthStart);
  }
});

test('every period carries a human label and comparison label', () => {
  for (const key of PERIOD_KEYS) {
    const q = key === 'custom'
      ? { period: 'custom', from: '2026-03-01', to: '2026-03-10' }
      : { period: key };
    const p = resolvePeriod(q, NOW);
    assert.ok(p.label && typeof p.label === 'string', `${key} missing label`);
    assert.ok(p.comparisonLabel && typeof p.comparisonLabel === 'string', `${key} missing comparisonLabel`);
  }
});
