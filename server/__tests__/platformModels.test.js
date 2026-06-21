const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const PlatformSettlement = require('../models/PlatformSettlement');
const User = require('../models/User');

const oid = () => new mongoose.Types.ObjectId();

test('PlatformWalletTransaction: valid doc passes, no required tenant', () => {
  const doc = new PlatformWalletTransaction({
    userId: oid(), type: 'credit', amount: 100, balanceAfter: 100, source: 'purchase',
  });
  assert.strictEqual(doc.validateSync(), undefined);
  assert.strictEqual(doc.schema.path('tenant'), undefined); // platform-scoped: no tenant field
  assert.strictEqual(doc.redeemedAtTenant, null);
});

test('PlatformWalletTransaction: enforces enums and positive amount', () => {
  const bad = new PlatformWalletTransaction({ userId: oid(), type: 'nope', amount: 0, balanceAfter: 0, source: 'bad' });
  const err = bad.validateSync();
  assert.ok(err.errors.type);
  assert.ok(err.errors.amount);
  assert.ok(err.errors.source);
});

test('GiftCard: valid pending card passes; status/currency enums enforced', () => {
  const card = new GiftCard({ initialAmount: 5000 });
  const err = card.validateSync();
  assert.strictEqual(err, undefined);
  assert.strictEqual(card.status, 'pending_payment');
  assert.strictEqual(card.currency, 'NGN');
  assert.strictEqual(card.balance, 0);

  const bad = new GiftCard({ initialAmount: 0, status: 'weird' });
  const e2 = bad.validateSync();
  assert.ok(e2.errors.initialAmount);
  assert.ok(e2.errors.status);
});

test('GiftCardTransaction: valid doc passes, redeemedAtTenant defaults null', () => {
  const tx = new GiftCardTransaction({ giftCardId: oid(), type: 'issue', amount: 5000, balanceAfter: 5000 });
  assert.strictEqual(tx.validateSync(), undefined);
  assert.strictEqual(tx.redeemedAtTenant, null);
  const bad = new GiftCardTransaction({ giftCardId: oid(), type: 'x', amount: 0, balanceAfter: 0 });
  assert.ok(bad.validateSync().errors.type);
});

test('PlatformSettlement: refPath + enums + default status', () => {
  const s = new PlatformSettlement({
    tenant: oid(), instrument: 'gift_card', sourceModel: 'GiftCardTransaction',
    sourceTxId: oid(), amount: 400,
  });
  assert.strictEqual(s.validateSync(), undefined);
  assert.strictEqual(s.status, 'pending');
  const bad = new PlatformSettlement({ tenant: oid(), instrument: 'x', sourceModel: 'Y', sourceTxId: oid(), amount: 0 });
  const err = bad.validateSync();
  assert.ok(err.errors.instrument);
  assert.ok(err.errors.sourceModel);
  assert.ok(err.errors.amount);
});

test('User.platformWalletBalance: default 0, min 0, distinct from walletBalance', () => {
  const u = new User({ email: 'a@b.com', firstName: 'A', role: 'customer' });
  assert.strictEqual(u.platformWalletBalance, 0);
  assert.ok(u.schema.path('walletBalance')); // existing tenant wallet untouched

  const bad = new User({ email: 'a@b.com', firstName: 'A', role: 'customer', platformWalletBalance: -5 });
  assert.ok(bad.validateSync().errors.platformWalletBalance);
});
