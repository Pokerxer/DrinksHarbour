'use strict';
const axios = require('axios');
const { AppError } = require('../utils/errors');
function options() {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new AppError('Paystack is not configured', 503, true);
  return { timeout: 15000, headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } };
}
async function initialize(checkout) {
  const response = await axios.post('https://api.paystack.co/transaction/initialize', {
    email: checkout.email, amount: checkout.amountKobo, currency: 'NGN', reference: checkout.reference,
    callback_url: checkout.returnUrl, metadata: { integrationCheckout: checkout._id, tenant: String(checkout.tenant), orderId: String(checkout.order) },
  }, options());
  const data = response.data?.data;
  if (!response.data?.status || data?.reference !== checkout.reference ||
      typeof data.authorization_url !== 'string' || !data.authorization_url.startsWith('https://checkout.paystack.com/')) {
    throw new AppError('Unable to initialize checkout payment', 502, true);
  }
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}
async function verify(reference) {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, options());
    const data = response.data?.data;
    if (!response.data?.status || !data) throw new AppError('Payment verification is unavailable', 502, true);
    return { reference: data.reference, status: data.status, amount: data.amount / 100,
      currency: data.currency, transactionId: String(data.id), paidAt: data.paid_at, channel: data.channel };
  } catch (error) {
    // Never treat a network error or an arbitrary 404 as a declined transaction.
    if (error.response?.status === 404 && /transaction.*not found|transaction.*does not exist/i.test(error.response?.data?.message || '')) {
      return { reference, status: 'not_found' };
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Payment verification is unavailable; retry shortly', 502, true);
  }
}
module.exports = { initialize, verify, assertConfigured: options };
