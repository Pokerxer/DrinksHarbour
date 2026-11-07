'use strict';
const Order = require('../models/Order');
const Refund = require('../models/MarketplaceRefund');
const Claim = require('../models/MarketplacePaymentClaim');
const access = require('./orderAccess');
const { ValidationError, ConflictError } = require('../utils/errors');
async function execute(orderId, amount, actor) {
  const order = await Order.findById(orderId);
  access.assertMutation(order, actor);
  require('./merchantFulfillment/identity').assertLegacy(order, 'Use allocated merchant refunds');
  if (order.integrationCheckout || order.tableServiceBooking || order.venueIdentityVersion === 1 || order.source === 'pos') {
    throw new ConflictError('Use the channel refund review workflow');
  }
  const receipt = await Claim.findOne({ order: order._id, state: 'allocated', provider: 'stripe', account: 'platform' }).lean();
  if (!receipt) throw new ValidationError('Provider refund is unsupported without an allocated Stripe receipt; reconciliation required');
  if (String(receipt.user) !== String(order.user) || receipt.amount !== order.totalAmount || receipt.currency !== order.currency) throw new ConflictError('Refund receipt does not match the order owner, amount or currency');
  const n = amount == null ? order.totalAmount : Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > order.totalAmount) throw new ValidationError('Invalid refund amount');
  const identity = `refund:${order._id}`;
  const existing = await Refund.findById(identity).lean();
  if (existing) {
    if (existing.amount !== n) throw new ConflictError('Refund already requested with another amount');
    if (existing.state === 'succeeded') return { success: true, refundId: existing.refundId, amount: existing.amount };
    throw new ConflictError('Refund outcome requires reconciliation; do not retry the charge');
  }
  if (order.paymentStatus !== 'paid' || ['cancelled', 'refunded'].includes(order.status)) throw new ConflictError('Order is not eligible for refund');
  if (!process.env.STRIPE_SECRET_KEY) throw new ValidationError('Stripe is not configured');
  await access.audit(order, actor, 'order_refund');
  try { await Refund.create({ _id: identity, order: order._id, actor: actor._id, amount: n, currency: order.currency,
    providerReference: receipt.reference, state: 'pending' }); }
  catch (error) { if (error.code === 11000) throw new ConflictError('Refund already requested; reconcile outcome'); throw error; }
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const result = await stripe.refunds.create({ payment_intent: receipt.reference, amount: Math.round(n * 100) }, { idempotencyKey: identity });
    if (result.status !== 'succeeded' || result.amount !== Math.round(n * 100) || String(result.currency).toUpperCase() !== order.currency) {
      throw new ConflictError('Refund outcome requires reconciliation');
    }
    order.paymentStatus = n < order.totalAmount ? 'partially_refunded' : 'refunded';
    order.refundDetails = { refundId: result.id, amount: n, reason: 'Authorized provider refund', createdAt: new Date(), processedBy: actor._id };
    await order.save();
    await Refund.updateOne({ _id: identity }, { $set: { state: 'succeeded', refundId: result.id } });
    return { success: true, refundId: result.id, amount: n };
  } catch (error) {
    await Refund.updateOne({ _id: identity }, { $set: { state: 'uncertain', issue: 'Provider or local commit outcome requires reconciliation' } });
    throw error;
  }
}
module.exports = { execute };
