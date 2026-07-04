process.env.GIFTCARD_QR_SECRET = process.env.GIFTCARD_QR_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const {
  getGiftCardByClaimToken,
  claimGiftCard,
} = require('../controllers/giftcard.controller');

function mockRes() {
  const res = {};
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

test('getGiftCardByClaimToken: returns gift info for a valid unclaimed token', async (t) => {
  const cardId = new mongoose.Types.ObjectId();
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: cardId,
        initialAmount: 25000,
        currency: 'NGN',
        design: { tier: 'classic' },
        recipient: { name: 'Alice', message: 'Enjoy!' },
        claimedBy: null,
        status: 'active',
      }),
    }),
  }));

  const req = { params: { token: 'abc-token' } };
  const res = mockRes();
  await getGiftCardByClaimToken(req, res);
  assert.strictEqual(res._body.success, true);
  assert.strictEqual(res._body.data.amount, 25000);
  assert.strictEqual(res._body.data.alreadyClaimed, false);
});

test('getGiftCardByClaimToken: returns alreadyClaimed when claimedBy is set', async (t) => {
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        claimedBy: new mongoose.Types.ObjectId(),
        status: 'active',
        initialAmount: 25000,
        currency: 'NGN',
        design: {},
        recipient: {},
      }),
    }),
  }));

  const req = { params: { token: 'claimed-token' } };
  const res = mockRes();
  await getGiftCardByClaimToken(req, res);
  assert.strictEqual(res._body.data.alreadyClaimed, true);
});

test('claimGiftCard: rejects if buyer tries to claim own card', async (t) => {
  const userId = new mongoose.Types.ObjectId();
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: new mongoose.Types.ObjectId(),
        purchasedBy: userId,
        claimedBy: null,
        status: 'active',
      }),
    }),
  }));

  const req = { params: { token: 'tok' }, user: { _id: userId } };
  const res = mockRes();
  await claimGiftCard(req, res);
  assert.strictEqual(res._status, 400);
  assert.ok(res._body.message.includes('cannot claim your own'));
});

test('getGiftCardByClaimToken: returns 404 for unknown token', async (t) => {
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({ lean: async () => null }),
  }));

  const req = { params: { token: 'bad-token' } };
  const res = mockRes();
  await getGiftCardByClaimToken(req, res);
  assert.strictEqual(res._status, 404);
});
