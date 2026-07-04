process.env.GIFTCARD_QR_SECRET = process.env.GIFTCARD_QR_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const { issueGiftCard } = require('../services/giftCard.service');

test('issueGiftCard generates claimToken when recipient email is set', async (t) => {
  const card = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending_payment',
    initialAmount: 25000,
    design: undefined,
    recipient: { email: 'friend@example.com', name: 'Friend' },
    claimToken: undefined,
    save: async function () { return this; },
  };

  t.mock.method(GiftCard, 'findById', async () => card);
  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => null }));
  t.mock.method(GiftCardTransaction, 'create', async () => ({}));

  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-x', createdBy: card._id });

  assert.strictEqual(res.ok, true);
  assert.ok(typeof card.claimToken === 'string' && card.claimToken.length > 0,
    'claimToken should be set when recipient email is present');
});

test('issueGiftCard does NOT generate claimToken when no recipient', async (t) => {
  const card = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending_payment',
    initialAmount: 25000,
    design: undefined,
    recipient: undefined,
    claimToken: undefined,
    save: async function () { return this; },
  };

  t.mock.method(GiftCard, 'findById', async () => card);
  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => null }));
  t.mock.method(GiftCardTransaction, 'create', async () => ({}));

  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-y', createdBy: card._id });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(card.claimToken, undefined, 'claimToken should not be set without a recipient');
});
