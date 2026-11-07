'use strict';
const Claim = require('../models/MarketplacePaymentClaim');
const { NotFoundError } = require('../utils/errors');
async function authorize(provider, reference, actor) {
  const row = await Claim.findById(`${provider}:platform:${reference}`).lean();
  if (!row || !actor || String(row.user) !== String(actor._id)) throw new NotFoundError('Payment not found');
  return row;
}
function publicReceipt(data) {
  return Object.fromEntries(['reference', 'transactionId', 'amount', 'currency', 'paidAt', 'channel', 'paymentMethod'].filter(k => data?.[k] !== undefined).map(k => [k, data[k]]));
}
module.exports = { authorize, publicReceipt };
