// Follows the repo convention (see salesOrder.api.test.js): mock Mongoose model
// methods with node:test's t.mock rather than booting a real DB.
// Set the QR signing secret before requiring the service (it reads the env at load).
process.env.GIFTCARD_QR_SECRET = process.env.GIFTCARD_QR_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const { issueGiftCard } = require('../services/giftCard.service');

test('issueGiftCard stamps the amount tier on design.tier', async (t) => {
  const card = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending_payment',
    initialAmount: 1000000,
    design: undefined,
    save: async function () { return this; },
  };

  t.mock.method(GiftCard, 'findById', async () => card);
  // The uniqueness check does `GiftCard.findOne(...).select('_id')`; return no clash.
  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => null }));
  t.mock.method(GiftCardTransaction, 'create', async () => ({}));

  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-1', createdBy: card._id });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(card.status, 'active');
  assert.strictEqual(card.design.tier, 'premium'); // ₦1,000,000 → premium band
});
