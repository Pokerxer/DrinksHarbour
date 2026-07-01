const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/salesActivity.service');

test('formatMoney groups to 2dp with ₦', () => {
  assert.strictEqual(svc.formatMoney(269500), '269,500.00 ₦');
  assert.strictEqual(svc.formatMoney(238931.67), '238,931.67 ₦');
});

test('diffPricelist returns from/to only on change', () => {
  assert.deepStrictEqual(svc.diffPricelist('A', 'B'), { from: 'A', to: 'B' });
  assert.strictEqual(svc.diffPricelist('A', 'A'), null);
  assert.strictEqual(svc.diffPricelist(undefined, undefined), null);
});

test('diffTotals reports total + untaxed deltas', () => {
  const prev = { total: 100, subtotal: 100, discountTotal: 0, promotionTotal: 0 };
  const next = { total: 90,  subtotal: 100, discountTotal: 10, promotionTotal: 0 };
  assert.deepStrictEqual(svc.diffTotals(prev, next), {
    total:   { from: 100, to: 90 },
    untaxed: { from: 100, to: 90 },
  });
  assert.strictEqual(svc.diffTotals(prev, prev), null);
});

test('statusSubject maps lifecycle actions', () => {
  assert.strictEqual(svc.statusSubject('quotation', 'sent'), 'Quotation sent');
  assert.strictEqual(svc.statusSubject('quotation', 'converted'), 'Converted to Sales Order');
  assert.strictEqual(svc.statusSubject('order', 'confirmed'), 'Sales Order confirmed');
});
