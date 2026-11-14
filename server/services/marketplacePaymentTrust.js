'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Claim = require('../models/MarketplacePaymentClaim');
const Order = require('../models/Order');
const { ConflictError, ValidationError, NotFoundError } = require('../utils/errors');
const { normalizePaymentMethod } = require('../utils/paymentMethods');
const key = (provider, reference) => `${provider}:platform:${reference}`;
const minor = n => Math.round(Number(n) * 100);
function fingerprint(data) {
  return crypto.createHash('sha256').update(JSON.stringify({ user: String(data.user || ''), items: data.items.map(i => ({
    subproduct: String(i.subproduct), size: String(i.size || ''), quantity: i.quantity, price: i.priceAtPurchase,
  })), amount: data.totalAmount, currency: data.currency, shipping: data.shippingAddress, coupon: String(data.coupon || ''), channelSnapshot: data.channelSnapshot })).digest('hex');
}
async function initialize(provider, actor, amount, currency, email, metadata = {}, requestKey, extraMetadata = null) {
  if (!actor?._id || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || minor(amount) <= 0) throw new ValidationError('Invalid payment amount');
  currency = String(currency || 'NGN').toUpperCase();
  if (currency !== 'NGN') throw new ValidationError('Marketplace checkout currently requires NGN');
  if (typeof requestKey !== 'string' || !requestKey || requestKey.length > 128) throw new ValidationError('Idempotency-Key is required for payment initialization');
  const reference = `dhm-${crypto.createHash('sha256').update(`${actor._id}:${provider}:${requestKey}`).digest('hex')}`;
  const Funding = require('../models/CheckoutDebit');
  const fundingId = crypto.createHash('sha256').update(`${actor._id}:${requestKey}`).digest('hex');
  const funding = await Funding.findById(fundingId).lean();
  if (funding && funding.method !== provider) throw new ConflictError('Checkout key already funds another payment method');
  const prior = await Claim.findById(key(provider, reference)).lean();
  if (prior) {
    if (minor(prior.amount) !== minor(amount) || prior.currency !== currency) throw new ConflictError('Payment key already used for another amount');
    if (prior.initialization) return prior.initialization;
    throw new ConflictError('Payment initialization outcome requires reconciliation; do not initialize another charge');
  }
  const channelSnapshot = await require('./marketCommitment').collectionSnapshot(provider, currency);
  if (!funding) {
    try { await Funding.create({ _id: fundingId, user: actor._id, method: provider, reference, channelSnapshot }); }
    catch (error) { if (error.code === 11000) throw new ConflictError('Checkout funding is in progress; retry the same key'); throw error; }
  }
  let row;
  try { row = await Claim.create({ _id: key(provider, reference), provider, reference, user: actor._id,
    amount: Number(amount), currency, channelSnapshot, state: 'initializing', expiresAt: new Date(Date.now() + 86400000) }); } catch (error) {
    if (error.code === 11000) throw new ConflictError('Payment initialization in progress; retry with same key');
    throw error;
  }
  const trusted = { customerName: metadata.customerName, customerPhone: metadata.customerPhone,
    kind: 'marketplace_order', userId: String(actor._id), paymentAccount: 'platform', reference };
  // Manual-intake invoices bind the charge to an existing order so both the
  // redirect return and the webhook can find it. Only orderId is honoured —
  // kind/userId/paymentAccount stay trust-controlled.
  if (extraMetadata && extraMetadata.orderId) trusted.orderId = String(extraMetadata.orderId);
  // Ad wallet top-ups ride this same charge path. The gateway metadata is the
  // only durable carrier of purpose/tenant (verify + webhook echo it), and the
  // controller is required to have stamped tenantId from the JWT (Workstream A).
  if (metadata.purpose === 'ad_wallet') {
    if (!mongoose.isValidObjectId(metadata.tenantId)) throw new ValidationError('Ad wallet top-up requires a valid tenant');
    trusted.purpose = 'ad_wallet';
    trusted.tenantId = String(metadata.tenantId);
  }
  try {
    const service = require('./payment.service');
    const result = provider === 'stripe' ? await service.createStripePaymentIntent(Number(amount), currency, trusted)
      : await (provider === 'paystack' ? service.createPaystackTransaction : service.createKorapayCharge)(Number(amount), email, trusted,
          { reference, ...(extraMetadata?.callbackUrl ? { callbackUrl: extraMetadata.callbackUrl } : {}) });
    if (provider === 'stripe') {
      // Stripe assigns the identity; retain the initialized reference as trusted metadata.
      await Claim.create({ ...row.toObject(), _id: key(provider, result.paymentIntentId), reference: result.paymentIntentId, state: 'ready', initialization: result });
      await Claim.updateOne({ _id: row._id }, { $set: { state: 'ready', initialization: result } });
    } else {
      if (result.reference !== reference) throw new ConflictError('Provider returned a different payment reference');
      await Claim.updateOne({ _id: row._id }, { $set: { state: 'ready', initialization: result } });
    }
    return result;
  } catch (error) {
    await Claim.updateOne({ _id: row._id }, { $set: { state: 'uncertain', issue: 'Initialization outcome requires reconciliation' } });
    throw error;
  }
}
async function evidence(details, actor, orderData) {
  const provider = details?.method, reference = details?.reference || details?.transactionId;
  if (!actor?._id || !['paystack', 'korapay', 'stripe', 'wallet', 'gift_card'].includes(provider) || typeof reference !== 'string' || !reference) {
    throw new ValidationError('Verified payment receipt and signed-in customer required');
  }
  const identity = key(provider, reference);
  let claim = await Claim.findById(identity).lean();
  if (claim && String(claim.user) !== String(actor._id)) throw new NotFoundError('Payment not found');
  if (claim?.state === 'needs_review') throw new ConflictError('Payment requires reconciliation');
  if (claim?.state === 'allocated') return { claim, identity, receipt: claim.receipt };
  let receipt;
  if (['wallet', 'gift_card'].includes(provider)) {
    if (!mongoose.isValidObjectId(reference)) throw new ValidationError('Invalid stored-value receipt');
    const Model = require(provider === 'wallet' ? '../models/PlatformWalletTransaction' : '../models/GiftCardTransaction');
    const filter = provider === 'wallet'
      ? { _id: reference, userId: actor._id, type: 'debit', source: 'online_checkout', relatedOrder: null }
      : { _id: reference, createdBy: actor._id, type: 'redeem', checkoutReceipt: true, relatedOrder: null };
    const tx = await Model.findOne(filter).lean();
    if (!tx) throw new NotFoundError('Payment not found');
    if (!claim && await Order.exists({ $or: [{ 'paymentDetails.transactionId': reference }, { 'paymentDetails.reference': reference }, { paymentReference: reference }, { paymentIntentId: reference }] })) throw new ConflictError('Payment receipt already funds an order; reconciliation required');
    receipt = { method: provider, reference, transactionId: reference, amount: tx.amount, currency: 'NGN', paidAt: tx.createdAt };
    if (!claim) {
      const funding = await require('../models/CheckoutDebit').findOne({ user: actor._id, method: provider, transaction: tx._id }).lean();
      claim = { user: actor._id, amount: tx.amount, currency: 'NGN', channelSnapshot: funding?.channelSnapshot, expiresAt: new Date(new Date(tx.createdAt).getTime() + 86400000) };
    }
  } else {
    if (!claim || claim.provider !== provider || claim.account !== 'platform') throw new NotFoundError('Payment not found');
    const service = require('./payment.service');
    let result;
    try { result = await (provider === 'stripe' ? service.confirmStripePayment : provider === 'paystack' ? service.verifyPaystackTransaction : service.verifyKorapayCharge)(reference); }
    catch (error) {
      await Claim.updateOne({ _id: identity, state: { $ne: 'allocated' } }, { $set: { state: 'uncertain', issue: 'Verification unavailable; reconcile saved reference' } });
      throw error;
    }
    const data = provider === 'stripe' ? { ...result, reference: result.paymentIntentId } : result.data;
    if (!result.success || !data || data.reference !== reference || data.metadata?.kind !== 'marketplace_order' ||
        data.metadata?.userId !== String(actor._id) || data.metadata?.paymentAccount !== 'platform' ||
        minor(data.amount) !== minor(claim.amount) || String(data.currency).toUpperCase() !== claim.currency) throw new ConflictError('Payment evidence does not match checkout');
    // Prepaid ad spend is not order money: a top-up must never fund an order,
    // otherwise the same receipt could be spent twice (order + wallet credit).
    if (data.metadata?.purpose === 'ad_wallet') throw new ConflictError('Ad wallet top-ups cannot fund orders');
    receipt = { method: provider, reference, transactionId: String(data.transactionId || reference), amount: Number(data.amount),
      currency: String(data.currency).toUpperCase(), paidAt: data.paidAt || new Date(), channel: data.channel };
  }
  if (!claim.expiresAt || new Date(claim.expiresAt) <= new Date()) {
    await Claim.updateOne({ _id: identity, state: { $ne: 'allocated' } }, { $set: { provider, reference, user: actor._id, amount: receipt.amount, currency: receipt.currency, receipt, state: 'needs_review', issue: 'Payment proof expired; reconciliation required' } }, { upsert: true });
    throw new ConflictError('Payment proof expired; reconciliation required');
  }
  if (minor(receipt.amount) !== minor(orderData.totalAmount) || receipt.currency !== orderData.currency) throw new ConflictError('Payment amount or currency does not match order');
  return { identity, claim, receipt };
}
async function claimReceipt(proof, data, session, requestFingerprint) {
  if (proof.claim.channelSnapshot || data.channelSnapshot) require('./marketCommitment').assertBinding(proof.claim.channelSnapshot, data.channelSnapshot);
  const fp = fingerprint(data);
  const row = await Claim.findById(proof.identity).session(session);
  if (row?.state === 'allocated') {
    if (row.fingerprint !== fp) throw new ConflictError('Payment receipt already funds another order');
    const prior = await Order.findById(row.order).session(session);
    if (!prior) throw new ConflictError('Allocated payment requires reconciliation');
    return prior;
  }
  if (row?.state === 'needs_review') throw new ConflictError('Payment requires reconciliation');
  const saved = { provider: proof.receipt.method, reference: proof.receipt.reference, account: 'platform', user: data.user,
    amount: proof.receipt.amount, currency: proof.receipt.currency, receipt: proof.receipt, requestFingerprint, channelSnapshot: proof.claim.channelSnapshot, state: 'allocated', order: data._id, fingerprint: fp };
  if (row) { row.set(saved); await row.save({ session }); }
  else await Claim.create([{ _id: proof.identity, ...saved }], { session });
  return null;
}
async function createOrder(data, tenantConfigs, details, actor, requestKey, requestFingerprint) {
  const proof = details ? await evidence(details, actor, data) : null;
  const Request = require('../models/OrderCheckoutRequest');
  if (!proof && (typeof requestKey !== 'string' || !requestKey || requestKey.length > 128)) throw new ValidationError('Idempotency-Key is required for unpaid checkout');
  const requestId = requestKey ? crypto.createHash('sha256').update(`${actor?._id || 'guest'}:${requestKey}`).digest('hex') : null;
  const session = await mongoose.startSession(); let order;
  data._id = new mongoose.Types.ObjectId();
  try {
    await session.withTransaction(async () => {
      if (requestId) {
        const prior = await Request.findById(requestId).session(session).lean();
        if (prior) {
          if (prior.fingerprint !== fingerprint(data)) throw new ConflictError('Checkout key already used for another order');
          order = await Order.findById(prior.order).session(session);
          if (!order) throw new ConflictError('Checkout outcome requires reconciliation');
          order.$locals.checkoutReplayed = true; return;
        }
        await Request.create([{ _id: requestId, fingerprint: fingerprint(data), requestFingerprint, order: data._id }], { session });
      }
      if (proof) {
        const prior = await claimReceipt(proof, data, session, requestFingerprint);
        if (prior) { order = prior; order.$locals.checkoutReplayed = true; return; }
        Object.assign(data, { paymentStatus: 'paid', status: 'confirmed', paidAt: proof.receipt.paidAt,
          paymentDetails: proof.receipt, paymentReference: proof.receipt.reference,
          paymentMethod: normalizePaymentMethod(proof.receipt.channel) || normalizePaymentMethod(proof.receipt.method) || data.paymentMethod });
      }
      order = await require('./storefrontLocationOrders').createMappedOrder(data, tenantConfigs, { session });
      if (!order) {
        await require('./storefrontStock').reserveStock(data.items, session);
        order = new Order({ ...data, onlineStockVersion: 1 }); order.$locals.deferAccounting = true; await order.save({ session });
      }
    });
  } catch (error) {
    // A parallel request may have won the unique receipt insert.
    if (error.code === 11000 && (proof || requestId)) {
      const row = proof ? await Claim.findById(proof.identity).lean() : await Request.findById(requestId).lean();
      if (row?.fingerprint === fingerprint(data)) { order = await Order.findById(row.order); order.$locals.checkoutReplayed = true; }
      else throw new ConflictError('Payment receipt already funds another order');
    } else throw error;
  } finally { await session.endSession(); }
  if (order.paymentStatus === 'paid') await require('./accounting.orders').captureOrderAccounting(order);
  return order;
}
async function attach(order, details, actor) {
  require('./orderAccess').assertMutation(order, actor, { customer: true });
  if (String(order.user) !== String(actor?._id)) throw new NotFoundError('Order not found');
  const proof = await evidence(details, actor, order);
  if (proof.claim.order && String(proof.claim.order) !== String(order._id)) throw new ConflictError('Payment receipt already funds another order');
  const session = await mongoose.startSession(); let saved;
  try {
    await session.withTransaction(async () => {
      saved = await Order.findById(order._id).session(session);
      if (saved.paymentStatus === 'paid') {
        if (saved.paymentReference !== proof.receipt.reference) throw new ConflictError('Order already has another receipt');
        return;
      }
      if (['cancelled', 'refunded', 'failed'].includes(saved.status) || saved.paymentStatus !== 'pending') {
        await Claim.updateOne({ _id: proof.identity }, { $set: { provider: proof.receipt.method, reference: proof.receipt.reference, user: saved.user, amount: proof.receipt.amount, currency: proof.receipt.currency, receipt: proof.receipt, order: saved._id, state: 'needs_review', issue: 'Late payment after stock release' } }, { session, upsert: true });
        return;
      }
      await claimReceipt(proof, saved, session);
      saved.set({ paymentStatus: 'paid', status: 'confirmed', paidAt: proof.receipt.paidAt, paymentDetails: proof.receipt, paymentReference: proof.receipt.reference });
      saved.$locals.deferAccounting = true; await saved.save({ session });
    });
  } finally { await session.endSession(); }
  if (saved.paymentStatus !== 'paid') throw new ConflictError('Late payment requires reconciliation; stock was not reacquired');
  await require('./accounting.orders').captureOrderAccounting(saved);
  return saved;
}
module.exports = { initialize, evidence, createOrder, attach, claimReceipt, fingerprint };
