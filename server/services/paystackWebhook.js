'use strict';
const crypto = require('node:crypto');
const Order = require('../models/Order');
const settlement = require('./storefrontSettlement');
const { ConflictError } = require('../utils/errors');
function validSignature(raw, signature, secret) {
  if (!Buffer.isBuffer(raw) || typeof signature !== 'string' || !/^[a-f\d]{128}$/i.test(signature) || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
async function processEvent(event) {
  if (event.event !== 'charge.success') return;
  const data = event.data || {};
  const payment = { reference: data.reference, status: data.status, transactionId: String(data.id || ''),
    amount: data.amount / 100, currency: data.currency, paidAt: data.paid_at, channel: data.channel };
  if (typeof data.reference !== 'string' || !data.reference) throw new ConflictError('Missing payment reference');
  if (data.reference.startsWith('dhw-')) {
    if (!await settlement.settlePayment(data.reference, payment)) throw new ConflictError('Checkout payment reference not found');
    return;
  }
  const order = await Order.findOne({ paymentReference: data.reference });
  if (!order || order.paymentStatus === 'paid') return;
  if (order.integrationCheckout) throw new ConflictError('Integration payment must use its checkout reference');
  if (data.status !== 'success' || data.currency !== (order.currency || 'NGN') ||
      !Number.isFinite(data.amount) || data.amount !== Math.round(order.totalAmount * 100)) {
    throw new ConflictError('Payment amount or currency does not match order');
  }
  await require('./payment.service').attachPaymentToOrder(String(order._id), { ...payment, method: 'paystack' });
}
module.exports = { validSignature, processEvent };
