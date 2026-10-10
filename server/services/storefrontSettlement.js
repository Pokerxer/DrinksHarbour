'use strict';
const mongoose = require('mongoose');
const Checkout = require('../models/IntegrationCheckout');
const Order = require('../models/Order');
const stock = require('./storefrontStock');
const gateway = require('./storefrontGateway');
const { paymentMatches } = require('./storefrontPricing');
const { ConflictError, NotFoundError } = require('../utils/errors');
const { normalizePaymentMethod } = require('../utils/paymentMethods');
async function settlePayment(reference, payment) {
  let paidOrder = null;
  let handled = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      paidOrder = null;
      const row = await Checkout.findOne({ reference }).session(session).lean();
      if (!row) return;
      handled = true;
      if (!paymentMatches(row, payment)) throw new ConflictError('Payment amount, currency or reference does not match checkout');
      if (['paid', 'needs_review'].includes(row.state)) return;
      const filter = { _id: row.order, tenant: row.tenant, integrationCheckout: row._id, paymentReference: reference };
      const order = await Order.findOne(filter).session(session).lean();
      if (!order) throw new NotFoundError('Checkout order not found');
      const late = row.state === 'cancelled' || ['cancelled', 'refunded'].includes(order.status);
      const set = { paymentStatus: 'paid', paidAt: new Date(payment.paidAt || Date.now()),
        paymentMethod: normalizePaymentMethod(payment.channel) || 'card',
        paymentDetails: { method: 'paystack', transactionId: payment.transactionId, reference,
          amount: payment.amount, currency: 'NGN', channel: payment.channel, paidAt: new Date(payment.paidAt || Date.now()) } };
      if (late) {
        set.accountingStatus = 'needs_review';
        set.accountingIssue = 'Payment received after checkout cancellation; review refund before fulfillment';
      } else if (order.status === 'pending') {
        set.status = 'confirmed'; set.confirmedAt = new Date();
      }
      await Order.updateOne(filter, { $set: set }, { session });
      await Checkout.updateOne({ _id: row._id, tenant: row.tenant, state: row.state },
        { $set: { state: late ? 'needs_review' : 'paid', settledAt: new Date() } }, { session });
      if (!late) paidOrder = Order.hydrate({ ...order, ...set });
    });
  } finally { await session.endSession(); }
  if (paidOrder) await require('./accounting.orders').captureOrderAccounting(paidOrder);
  return handled;
}
async function cancelCheckout(tenant, key, value) {
  const row = await require('./storefrontCheckout.service').findCheckout(tenant, key, value);
  if (row.state === 'cancelled') return { id: value, status: 'cancelled' };
  if (['paid', 'needs_review'].includes(row.state)) throw new ConflictError('Paid checkout cannot be cancelled through this API');
  if (['pending', 'initializing'].includes(row.state) && Date.now() - new Date(row.initializedAt || row.createdAt || Date.now()).getTime() < 60000) {
    throw new ConflictError('Payment initialization is in progress; retry shortly');
  }
  const payment = await gateway.verify(row.reference);
  if (payment.status === 'success') {
    await settlePayment(row.reference, payment);
    throw new ConflictError('Checkout has already been paid');
  }
  if (payment.reference !== row.reference) throw new ConflictError('Payment reference does not match checkout');
  if (!['failed', 'abandoned', 'not_found'].includes(payment.status)) throw new ConflictError('Payment is still in progress; verify before cancellation');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Checkout.findOne({ _id: value, tenant: tenant._id, apiKey: key._id }).session(session).lean();
      if (current?.state === 'cancelled') return;
      if (!current || ['paid', 'needs_review'].includes(current.state)) throw new ConflictError('Checkout state changed');
      const filter = { _id: current.order, tenant: tenant._id, integrationCheckout: value };
      const order = await Order.findOne(filter).session(session).lean();
      if (!order || order.paymentStatus === 'paid' || !['pending', 'cancelled'].includes(order.status)) throw new ConflictError('Order is no longer cancellable');
      if (order.status !== 'cancelled') {
        await stock.releaseStock(order.items, session);
        await Order.updateOne(filter, { $set: { status: 'cancelled', paymentStatus: 'failed', cancelledAt: new Date(),
          cancelReason: 'Tenant website checkout cancelled', [`fulfillmentStatus.${tenant._id}`]: 'cancelled' } }, { session });
      }
      await Checkout.updateOne({ _id: value, tenant: tenant._id, state: current.state }, { $set: { state: 'cancelled' } }, { session });
    });
  } finally { await session.endSession(); }
  return { id: value, status: 'cancelled' };
}
module.exports = { settlePayment, cancelCheckout };
