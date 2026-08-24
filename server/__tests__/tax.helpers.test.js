// __tests__/tax.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  round2,
  groupLinesByRate,
  matchTaxByRate,
  buildSummary,
} = require('../services/tax.helpers');

test('round2 rounds to two decimals', () => {
  assert.equal(round2(112.444), 112.44);
  assert.equal(round2('x'), 0);
});

test('groupLinesByRate groups by rate and computes amounts', () => {
  const groups = groupLinesByRate([
    { taxableBase: 1000, taxRate: 7.5 },
    { taxableBase: 500, taxRate: 7.5 },
    { taxableBase: 200, taxRate: 0 },
  ]);
  assert.deepEqual(groups, [
    { taxRate: 0, taxableBase: 200, taxAmount: 0 },
    { taxRate: 7.5, taxableBase: 1500, taxAmount: 112.5 },
  ]);
});

test('matchTaxByRate prefers active default of matching type', () => {
  const taxes = [
    { rate: 7.5, type: 'output', isActive: false, isDefault: true, name: 'old' },
    { rate: 7.5, type: 'output', isActive: true, isDefault: true, name: 'VAT' },
    { rate: 7.5, type: 'input', isActive: true, isDefault: true, name: 'VAT-in' },
  ];
  assert.equal(matchTaxByRate(taxes, 7.5, 'output').name, 'VAT');
  assert.equal(matchTaxByRate(taxes, 20, 'output'), null);
});

test('buildSummary sums directions and per-tax breakdown', () => {
  const records = [
    { direction: 'collected', taxAmount: 75, taxName: 'VAT', taxRate: 7.5, status: 'posted' },
    { direction: 'collected', taxAmount: 25, taxName: 'Levy', taxRate: 2.5, status: 'posted' },
    { direction: 'paid', taxAmount: 50, taxName: 'VAT', taxRate: 7.5, status: 'posted' },
    { direction: 'paid', taxAmount: 999, taxName: 'VAT', taxRate: 7.5, status: 'reversed' },
  ];
  const s = buildSummary(records);
  assert.equal(s.collected, 100);
  assert.equal(s.paid, 50);
  assert.equal(s.netPayable, 50);
  assert.equal(s.byTax.find((t) => t.taxName === 'VAT').collected, 75);
});
