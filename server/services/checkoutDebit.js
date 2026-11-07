'use strict';
const crypto = require('node:crypto'), mongoose = require('mongoose');
const Request = require('../models/CheckoutDebit');
const { ValidationError, ConflictError } = require('../utils/errors');
async function pay(method, user, amount, code, requestKey) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError('Amount must be a positive integer');
  if (typeof requestKey !== 'string' || requestKey.length < 1 || requestKey.length > 128) throw new ValidationError('Idempotency-Key is required for checkout payment');
  const normalized = require('./giftCard.helpers').normalizeGiftCardCode;
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([n, method === 'gift_card' ? normalized(code) : null])).digest('hex');
  const identity = crypto.createHash('sha256').update(`${user}:${requestKey}`).digest('hex');
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const prior = await Request.findById(identity).session(session).lean();
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new ConflictError('Checkout key already used with different payment details');
        result = prior; return;
      }
      const channelSnapshot = await require('./marketCommitment').collectionSnapshot(method, 'NGN');
      let owner, tx;
      if (method === 'wallet') {
        owner = await require('../models/User').findOneAndUpdate({ _id: user, platformWalletBalance: { $gte: n } }, { $inc: { platformWalletBalance: -n } }, { new: true, session });
        if (!owner) throw new ValidationError('Insufficient platform wallet balance');
        [tx] = await require('../models/PlatformWalletTransaction').create([{ userId: user, type: 'debit', source: 'online_checkout', amount: n,
          balanceAfter: owner.platformWalletBalance, createdBy: user, reason: 'Order payment via platform wallet' }], { session });
        result = { balance: owner.platformWalletBalance };
      } else {
        if (!code) throw new ValidationError('Gift card code is required');
        owner = await require('../models/GiftCard').findOneAndUpdate({ code: normalized(code), status: 'active', balance: { $gte: n },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }, { $inc: { balance: -n } }, { new: true, session });
        if (!owner) throw new ValidationError('Gift card is unavailable or has insufficient balance');
        if (owner.balance === 0) { owner.status = 'redeemed'; await owner.save({ session }); }
        [tx] = await require('../models/GiftCardTransaction').create([{ giftCardId: owner._id, type: 'redeem', amount: n, balanceAfter: owner.balance, createdBy: user, checkoutReceipt: true }], { session });
        result = { balance: owner.balance, status: owner.status };
      }
      [result] = await Request.create([{ _id: identity, user, method, fingerprint, transaction: tx._id, channelSnapshot, ...result }], { session });
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    result = await Request.findById(identity).lean();
    if (!result || result.fingerprint !== fingerprint) throw new ConflictError('Checkout key already used with different payment details');
  } finally { await session.endSession(); }
  return { transactionId: result.transaction, balance: result.balance, cardBalance: result.balance, cardStatus: result.status };
}
module.exports = { pay };
