// Repo convention: mock Mongoose model methods with node:test's t.mock (no real DB).
// These tests prove the short-window idempotency guard short-circuits a duplicate
// redeem with an `alreadyProcessed` response, before any balance-moving service runs.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const User = require('../models/User');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const PlatformLoyaltyTransaction = require('../models/PlatformLoyaltyTransaction');
const loyaltyController = require('../controllers/loyalty.controller');
const giftCardController = require('../controllers/giftcard.controller');

function fakeRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  return {
    statusCode: 200, body: null, done,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; resolve(payload); return this; },
  };
}

test('loyalty redeem short-circuits a duplicate within the window', async (t) => {
  const uid = new mongoose.Types.ObjectId();

  t.mock.method(PlatformLoyaltyTransaction, 'find', () => ({ lean: async () => [{ points: -100 }] }));
  t.mock.method(User, 'findById', () => ({ select: async () => ({ loyaltyPoints: 500, platformWalletBalance: 9000 }) }));

  const req = { body: { points: 100 }, user: { _id: uid } };
  const res = fakeRes();
  loyaltyController.redeemLoyaltyPoints(req, res, (err) => { if (err) throw err; });
  await res.done;

  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.alreadyProcessed, true);
  assert.strictEqual(res.body.data.pointsBalance, 500);
  assert.strictEqual(res.body.data.walletBalance, 9000);
});

test('gift-card redeem short-circuits a duplicate within the window', async (t) => {
  const uid = new mongoose.Types.ObjectId();
  const cardId = new mongoose.Types.ObjectId();

  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => ({ _id: cardId, status: 'active', balance: 5000, code: 'DHGCX' }) }));
  t.mock.method(GiftCardTransaction, 'findOne', () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(), amount: 1000 }) }));
  t.mock.method(GiftCard, 'findById', () => ({ select: () => ({ lean: async () => ({ balance: 4000, status: 'active' }) }) }));
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ platformWalletBalance: 9000 }) }) }));

  const req = { params: { id: cardId }, body: { amount: 1000 }, user: { _id: uid } };
  const res = fakeRes();
  giftCardController.redeemMyGiftCard(req, res, (err) => { if (err) throw err; });
  await res.done;

  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.alreadyProcessed, true);
  assert.strictEqual(res.body.data.cardBalance, 4000);
  assert.strictEqual(res.body.data.walletBalance, 9000);
});
