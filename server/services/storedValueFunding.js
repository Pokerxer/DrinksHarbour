'use strict';
const mongoose = require('mongoose');
const Funding = require('../models/StoredValueFunding');
const { ConflictError, NotFoundError } = require('../utils/errors');
const identity = (provider, reference) => `${provider}:platform:${reference}`;
async function initialize({ user, amount, reference, kind, target, email, callbackUrl }) {
  const gateway = require('./payment.service'); const provider = gateway.ACTIVE_GATEWAY;
  const row = await Funding.create({ _id: identity(provider, reference), provider, reference, user, amount, currency: 'NGN', kind, target, state: 'initializing' });
  try {
    const result = await (provider === 'paystack' ? gateway.createPaystackTransaction : gateway.createKorapayCharge)(amount, email,
      { kind, userId: String(user), reference, ...(target ? { giftCardId: String(target) } : {}) }, { reference, callbackUrl });
    if (result.reference !== reference) throw new ConflictError('Provider returned a different reference');
    await Funding.updateOne({ _id: row._id }, { $set: { state: 'ready' } }); return result;
  } catch (error) {
    await Funding.updateOne({ _id: row._id }, { $set: { state: 'uncertain', issue: 'Initialization outcome requires reconciliation' } });
    throw error;
  }
}
async function verified(reference, user, kind, target) {
  const row = await Funding.findOne({ reference, user, kind, ...(target ? { target } : {}) }).lean();
  if (!row) throw new ConflictError('Funding reference is not bound to this purchase; reconciliation required');
  if (row.state === 'credited') return row;
  const gateway = require('./payment.service');
  let result;
  try { result = await (row.provider === 'paystack' ? gateway.verifyPaystackTransaction : gateway.verifyKorapayCharge)(row.reference); }
  catch (error) { await Funding.updateOne({ _id: row._id }, { $set: { state: 'uncertain', issue: 'Verification unavailable; reconcile saved reference' } }); throw error; }
  const data = result.data;
  if (!result.success || !data || data.reference !== row.reference || String(data.currency).toUpperCase() !== row.currency ||
      !Number.isFinite(data.amount) || Math.round(data.amount * 100) !== Math.round(row.amount * 100) ||
      data.metadata?.kind !== row.kind || data.metadata?.userId !== String(user) ||
      target && data.metadata?.giftCardId !== String(target)) throw new ConflictError('Funding receipt does not match customer, purpose, amount or currency');
  return row;
}
async function wallet(reference, user) {
  const row = await verified(reference, user, 'wallet_fund');
  const session = await mongoose.startSession(); let balance, alreadyCredited;
  try {
    await session.withTransaction(async () => {
      const current = await Funding.findById(row._id).session(session);
      if (current.state === 'credited') { alreadyCredited = true; balance = (await require('../models/User').findById(user).session(session)).platformWalletBalance; return; }
      const owner = await require('../models/User').findByIdAndUpdate(user, { $inc: { platformWalletBalance: row.amount } }, { new: true, session });
      if (!owner) throw new NotFoundError('Wallet owner not found');
      const [tx] = await require('../models/PlatformWalletTransaction').create([{ userId: user, type: 'credit', source: 'purchase', amount: row.amount,
        balanceAfter: owner.platformWalletBalance, paymentRef: row.reference, reference: row.reference, createdBy: user, reason: 'Wallet funding' }], { session });
      current.state = 'credited'; current.transaction = tx._id; await current.save({ session }); balance = owner.platformWalletBalance;
    });
  } finally { await session.endSession(); }
  return { balance, amount: row.amount, alreadyCredited: !!alreadyCredited };
}
async function gift(reference, giftCardId, user) {
  const card = await require('../models/GiftCard').findOne({ _id: giftCardId, purchasedBy: user }).lean();
  if (!card) throw new NotFoundError('Gift card not found');
  if (reference !== card.paymentRef) throw new ConflictError('Gift card payment reference does not match');
  const row = await verified(reference, user, 'gift_card_purchase', giftCardId);
  if (row.amount !== card.initialAmount || row.currency !== card.currency) throw new ConflictError('Gift-card funding amount or currency changed');
  const session = await mongoose.startSession(); let issued;
  try {
    await session.withTransaction(async () => {
      const current = await Funding.findById(row._id).session(session);
      issued = await require('./giftCard.service').issueGiftCard({ giftCardId, paymentRef: row.reference, createdBy: user, session });
      if (!issued.ok) throw new ConflictError(issued.message);
      current.state = 'credited'; await current.save({ session });
    });
  } finally { await session.endSession(); }
  return issued;
}
module.exports = { initialize, wallet, gift };
