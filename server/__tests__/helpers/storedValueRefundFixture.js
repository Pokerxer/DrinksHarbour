'use strict';
// Synthetic stored-value checkout fixtures for workstream W tests. These create
// exactly the recorded identities discovery binds (discovery identities 9):
// allocated claim → original debit ledger row → CheckoutDebit binding.
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();

async function walletCheckoutFixture({ amountNaira = 5, redeemedAtTenant = null, requestKey = 'wallet-request' } = {}) {
  const buyer = oid(), orderId = oid();
  await require('../../models/User').collection.insertOne({
    _id: buyer, role: 'customer', status: 'active', platformWalletBalance: 0,
  });
  const tx = await require('../../models/PlatformWalletTransaction').create({
    userId: buyer, type: 'debit', amount: amountNaira, balanceAfter: 0,
    source: 'online_checkout', relatedOrder: null, redeemedAtTenant,
    createdBy: buyer, reason: 'Order payment via platform wallet',
  });
  await require('../../models/CheckoutDebit').create({
    _id: crypto.createHash('sha256').update(`${buyer}:${requestKey}`).digest('hex'),
    user: buyer, method: 'wallet', transaction: tx._id,
  });
  await require('../../models/MarketplacePaymentClaim').create({
    _id: `wallet:platform:${tx._id}`, provider: 'wallet', account: 'platform',
    reference: String(tx._id), user: buyer, amount: amountNaira, currency: 'NGN',
    state: 'allocated', order: orderId,
    receipt: { method: 'wallet', reference: String(tx._id), transactionId: String(tx._id), amount: amountNaira, currency: 'NGN', paidAt: new Date() },
  });
  return { buyer, orderId, debitTxId: String(tx._id), originalMinor: amountNaira * 100 };
}

async function giftCheckoutFixture({ amountNaira = 5, expiresAt = null, status = 'redeemed', balance = 0, requestKey = 'gift-request' } = {}) {
  const buyer = oid(), orderId = oid(), giftCardId = oid();
  await require('../../models/User').collection.insertOne({ _id: buyer, role: 'customer', status: 'active' });
  await require('../../models/GiftCard').create({
    _id: giftCardId, code: `W${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    initialAmount: amountNaira, balance, status, purchasedBy: buyer, currency: 'NGN',
    ...(expiresAt ? { expiresAt } : {}),
  });
  const tx = await require('../../models/GiftCardTransaction').create({
    giftCardId, type: 'redeem', amount: amountNaira, balanceAfter: 0,
    checkoutReceipt: true, relatedOrder: null, createdBy: buyer,
  });
  await require('../../models/CheckoutDebit').create({
    _id: crypto.createHash('sha256').update(`${buyer}:${requestKey}`).digest('hex'),
    user: buyer, method: 'gift_card', transaction: tx._id,
  });
  await require('../../models/MarketplacePaymentClaim').create({
    _id: `gift_card:platform:${tx._id}`, provider: 'gift_card', account: 'platform',
    reference: String(tx._id), user: buyer, amount: amountNaira, currency: 'NGN',
    state: 'allocated', order: orderId,
    receipt: { method: 'gift_card', reference: String(tx._id), transactionId: String(tx._id), amount: amountNaira, currency: 'NGN', paidAt: new Date() },
  });
  return { buyer, orderId, giftCardId, debitTxId: String(tx._id), originalMinor: amountNaira * 100 };
}

// Explicitly synthetic recorded policy (production has none). Super-admin actor.
async function recordPolicy(kind, overrides = {}) {
  return require('../../services/merchantFulfillment/refundSources/policyAuthority').record(
    {
      kind,
      destination: 'original_object',
      amountPrecisionRule: 'whole_naira_units',
      ...(kind === 'gift_card' ? { giftExpiryRule: 'reject_if_expired' } : {}),
      decisionReference: `SYNTHETIC-W-${kind}`,
      ...overrides,
    },
    { _id: oid(), role: 'super_admin' },
  );
}

module.exports = { walletCheckoutFixture, giftCheckoutFixture, recordPolicy, oid };
