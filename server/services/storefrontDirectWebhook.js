'use strict';
const Checkout = require('../models/IntegrationCheckout');
const gateway = require('./storefrontGateway');
const { validSignature } = require('./paystackWebhook');
const { UnauthorizedError, ConflictError } = require('../utils/errors');
async function receive({ raw, signature, account }) {
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(account || '') || !validSignature(raw, signature, gateway.secret(account))) throw new UnauthorizedError('Invalid webhook signature');
  const event = JSON.parse(raw.toString('utf8'));
  if (event.event !== 'charge.success') return;
  const reference = event.data?.reference;
  if (typeof reference !== 'string' || !reference.startsWith('dhw-')) throw new ConflictError('Unknown website payment reference');
  const checkout = await Checkout.findOne({ reference, paymentAccount: account }).select('_id').lean();
  if (!checkout) throw new ConflictError('Website payment does not belong to this account');
  const payment = await gateway.verify(reference, account);
  if (payment.status !== 'success') throw new ConflictError('Payment is not yet verified');
  await require('./storefrontSettlement').settlePayment(reference, payment);
}
module.exports = { receive };
