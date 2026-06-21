const test = require('node:test');
const assert = require('node:assert');
const {
  PLATFORM_WALLET_TX_TYPES,
  PLATFORM_WALLET_SOURCES,
  validatePlatformWalletTx,
  applyPlatformWalletDelta,
  summarizePlatformWallet,
} = require('../services/platformWallet.helpers');

test('enums expose the platform wallet types and sources', () => {
  assert.deepStrictEqual(PLATFORM_WALLET_TX_TYPES, ['credit', 'debit', 'refund', 'adjustment']);
  assert.deepStrictEqual(PLATFORM_WALLET_SOURCES, ['purchase', 'pos', 'online_checkout', 'refund', 'adjustment']);
});

test('validatePlatformWalletTx accepts a valid credit', () => {
  const r = validatePlatformWalletTx({ type: 'credit', amount: 500, source: 'purchase', reason: '  top up ' });
  assert.deepStrictEqual(r, { ok: true, value: { type: 'credit', amount: 500, source: 'purchase', reason: 'top up' } });
});

test('validatePlatformWalletTx rejects bad type/source/amount', () => {
  assert.strictEqual(validatePlatformWalletTx({ type: 'x', amount: 1, source: 'purchase' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 1, source: 'x' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 0, source: 'purchase' }).ok, false);
  assert.strictEqual(validatePlatformWalletTx({ type: 'credit', amount: 1.5, source: 'purchase' }).ok, false);
});

test('validatePlatformWalletTx caps reason length', () => {
  const r = validatePlatformWalletTx({ type: 'credit', amount: 1, source: 'purchase', reason: 'a'.repeat(281) });
  assert.strictEqual(r.ok, false);
});

test('applyPlatformWalletDelta adds and subtracts with overdraw guard', () => {
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'credit', 50), { ok: true, balanceAfter: 150 });
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'refund', 50), { ok: true, balanceAfter: 150 });
  assert.deepStrictEqual(applyPlatformWalletDelta(100, 'debit', 40), { ok: true, balanceAfter: 60 });
  assert.strictEqual(applyPlatformWalletDelta(30, 'debit', 40).ok, false);
  assert.strictEqual(applyPlatformWalletDelta(100, 'debit', 0).ok, false);
});

test('summarizePlatformWallet rolls up credited/debited/net/count/lastActivityAt', () => {
  const s = summarizePlatformWallet([
    { type: 'credit', amount: 100, createdAt: '2026-01-01T00:00:00Z' },
    { type: 'debit', amount: 30, createdAt: '2026-02-01T00:00:00Z' },
    { type: 'refund', amount: 10, createdAt: '2026-01-15T00:00:00Z' },
  ]);
  assert.strictEqual(s.credited, 110);
  assert.strictEqual(s.debited, 30);
  assert.strictEqual(s.net, 80);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.lastActivityAt, '2026-02-01T00:00:00.000Z');
});
