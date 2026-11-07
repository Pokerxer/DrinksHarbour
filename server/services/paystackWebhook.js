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
  if (data.reference.startsWith('dhv-')) {
    await require('./venue/collections').verifyVenuePayment({ reference: data.reference });
    return;
  }
  if (data.reference.startsWith('dhw-')) {
    if (!await settlement.settlePayment(data.reference, payment)) throw new ConflictError('Checkout payment reference not found');
    return;
  }
  await require('./marketplaceWebhook').settle('paystack', data.reference);
}
module.exports = { validSignature, processEvent };
