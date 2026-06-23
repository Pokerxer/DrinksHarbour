// server/__tests__/salesPaymentTerms.test.js
// Odoo-style payment terms: a named term resolves to a due date computed off
// the document's base date. Pure helpers, no DB (repo convention).
const test = require('node:test');
const assert = require('node:assert');

test('PAYMENT_TERMS exposes the supported presets with day offsets', () => {
  const { PAYMENT_TERMS } = require('../services/salesOrder.service');
  const keys = PAYMENT_TERMS.map((t) => t.key);
  assert.deepStrictEqual(keys, [
    'immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'end_of_month',
  ]);
  assert.strictEqual(PAYMENT_TERMS.find((t) => t.key === 'net_30').days, 30);
  assert.strictEqual(PAYMENT_TERMS.find((t) => t.key === 'immediate').days, 0);
});

test('computeDueDate adds the term days to the base date', () => {
  const { computeDueDate } = require('../services/salesOrder.service');
  const base = new Date('2026-06-23T10:00:00.000Z');
  assert.strictEqual(computeDueDate('immediate', base).toISOString(), '2026-06-23T10:00:00.000Z');
  assert.strictEqual(computeDueDate('net_7', base).toISOString().slice(0, 10), '2026-06-30');
  assert.strictEqual(computeDueDate('net_30', base).toISOString().slice(0, 10), '2026-07-23');
});

test('computeDueDate end_of_month resolves to the last day of the base month', () => {
  const { computeDueDate } = require('../services/salesOrder.service');
  assert.strictEqual(
    computeDueDate('end_of_month', new Date('2026-06-23T10:00:00.000Z')).toISOString().slice(0, 10),
    '2026-06-30'
  );
  // February in a non-leap year
  assert.strictEqual(
    computeDueDate('end_of_month', new Date('2026-02-10T00:00:00.000Z')).toISOString().slice(0, 10),
    '2026-02-28'
  );
});

test('computeDueDate falls back to immediate for an unknown/blank term', () => {
  const { computeDueDate } = require('../services/salesOrder.service');
  const base = new Date('2026-06-23T00:00:00.000Z');
  assert.strictEqual(computeDueDate('nonsense', base).toISOString(), base.toISOString());
  assert.strictEqual(computeDueDate(undefined, base).toISOString(), base.toISOString());
});
