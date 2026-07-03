// Repo convention: mock Mongoose model methods with node:test's t.mock (no real DB).
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const giftCardController = require('../controllers/giftcard.controller');

function fakeRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  return {
    statusCode: 200,
    body: null,
    done,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; resolve(payload); return this; },
  };
}

test('getGiftCard returns a QR data URL for an issued card', async (t) => {
  const id = new mongoose.Types.ObjectId();
  const card = {
    _id: id, code: 'DHGCAB23CD45EF67', qrToken: 'signed.qr.token', initialAmount: 5000,
    balance: 5000, currency: 'NGN', status: 'active', recipient: {}, design: { tier: 'classic' },
    expiresAt: new Date(), createdAt: new Date(),
  };

  t.mock.method(GiftCard, 'findOne', () => ({ lean: async () => card }));
  t.mock.method(GiftCardTransaction, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));

  const req = { params: { id }, user: { _id: id } };
  const res = fakeRes();
  giftCardController.getGiftCard(req, res, (err) => { if (err) throw err; });
  await res.done;

  assert.strictEqual(res.statusCode, 200);
  const data = res.body.data;
  assert.ok(data.qrDataUrl.startsWith('data:image/png;base64,'));
  assert.strictEqual(data.qrToken, 'signed.qr.token');
});

test('getGiftCard returns null qrDataUrl when the card has no token', async (t) => {
  const id = new mongoose.Types.ObjectId();
  const card = {
    _id: id, code: null, qrToken: null, initialAmount: 5000, balance: 0, currency: 'NGN',
    status: 'pending_payment', recipient: {}, design: {}, expiresAt: new Date(), createdAt: new Date(),
  };

  t.mock.method(GiftCard, 'findOne', () => ({ lean: async () => card }));
  t.mock.method(GiftCardTransaction, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));

  const req = { params: { id }, user: { _id: id } };
  const res = fakeRes();
  giftCardController.getGiftCard(req, res, (err) => { if (err) throw err; });
  await res.done;

  assert.strictEqual(res.body.data.qrDataUrl, null);
});
