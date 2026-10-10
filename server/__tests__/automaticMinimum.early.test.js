const { test } = require('node:test');
const assert = require('node:assert/strict');
const { automaticMinimum } = require('../services/restock/minimum');
const { forecast } = require('../services/restock/model');
const now = new Date('2026-10-09T10:00:00Z');
const run = (values, extra = {}) => automaticMinimum({ values,
  forecast: forecast(values, 90, now), now, fallback: 10, ...extra });
test('a week of real local history produces a labelled early automatic minimum', () => {
  const result = run([6, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.status, 'active');
  assert.equal(result.confidence, 'early');
  assert.equal(result.method, 'short_history_baseline');
  assert.equal(result.model, null);
  assert.equal(result.historyDays, 7);
  assert.equal(result.units, 17);
});
test('intermittent sales do not need four separate sale days to qualify', () => {
  const values = [12, ...Array(39).fill(0)];
  const result = run(values);
  assert.equal(result.status, 'active');
  assert.equal(result.confidence, 'established');
  assert.equal(result.units, 9);
});
test('early minima respond to sales pace without promoting the forecast model', () => {
  const slow = run(Array(14).fill(1)), fast = run(Array(14).fill(3));
  assert.equal(slow.units, 9);
  assert.equal(fast.units, 27);
  assert.equal(slow.confidence, 'early');
  assert.equal(forecast(Array(14).fill(1), 90, now).method, 'insufficient_history');
});
test('short, empty and ambiguous history retain their fallback', () => {
  assert.equal(run(Array(6).fill(1)).status, 'learning');
  assert.equal(run(Array(30).fill(0)).units, 10);
  assert.equal(run(Array(14).fill(1), { incomplete: true }).status, 'incomplete');
});
