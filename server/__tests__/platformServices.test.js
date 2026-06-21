const test = require('node:test');
const assert = require('node:assert');

const platformWalletService = require('../services/platformWallet.service');
const giftCardService = require('../services/giftCard.service');

test('platformWallet.service exports mutatePlatformWallet', () => {
  assert.strictEqual(typeof platformWalletService.mutatePlatformWallet, 'function');
});

test('giftCard.service exports issue/redeem/refund', () => {
  assert.strictEqual(typeof giftCardService.issueGiftCard, 'function');
  assert.strictEqual(typeof giftCardService.redeemGiftCard, 'function');
  assert.strictEqual(typeof giftCardService.refundGiftCard, 'function');
});

test('redeemGiftCard rejects a non-positive amount before any DB call', async () => {
  const r = await giftCardService.redeemGiftCard({ code: 'DHGCAB23CD45EF67', amount: 0 });
  assert.deepStrictEqual(r, { ok: false, status: 400, message: 'Amount must be a positive integer' });
});

test('refundGiftCard rejects a non-positive amount before any DB call', async () => {
  const r = await giftCardService.refundGiftCard({ giftCardId: 'x', amount: -5 });
  assert.deepStrictEqual(r, { ok: false, status: 400, message: 'Amount must be a positive integer' });
});
