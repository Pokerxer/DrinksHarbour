const test = require('node:test');
const assert = require('node:assert');
const { buildTransactionFilter } = require('../controllers/wallet.controller');

test('valid type is applied, invalid type ignored', () => {
  assert.strictEqual(buildTransactionFilter('u1', { type: 'credit' }).type, 'credit');
  assert.strictEqual(buildTransactionFilter('u1', { type: 'bogus' }).type, undefined);
});

test('date range builds a createdAt window; absent dates omit it', () => {
  const f = buildTransactionFilter('u1', { from: '2026-01-01', to: '2026-01-31' });
  assert.ok(f.createdAt.$gte instanceof Date);
  assert.ok(f.createdAt.$lte instanceof Date);
  assert.strictEqual(buildTransactionFilter('u1', {}).createdAt, undefined);
});
