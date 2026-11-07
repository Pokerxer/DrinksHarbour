'use strict';
const Claim = require('../models/MarketplacePaymentClaim');
const Order = require('../models/Order');
const trust = require('./marketplacePaymentTrust');
const { ConflictError } = require('../utils/errors');
async function settle(provider, reference) {
  if (typeof reference !== 'string' || !reference) throw new ConflictError('Missing payment reference');
  const row = await Claim.findById(`${provider}:platform:${reference}`).lean();
  if (!row) return; // Other platform purposes (wallet funding/ERM/gifts) retain their own handlers.
  if (row.state === 'allocated') return;
  const actor = { _id: row.user, role: 'customer' };
  const proof = await trust.evidence({ method: provider, reference }, actor, { totalAmount: row.amount, currency: row.currency });
  if (row.order) {
    const order = await Order.findById(row.order);
    if (!order) throw new ConflictError('Payment order requires reconciliation');
    await trust.attach(order, { method: provider, reference }, actor);
  } else {
    await Claim.updateOne({ _id: row._id, state: { $in: ['ready', 'uncertain', 'initializing'] } },
      { $set: { receipt: proof.receipt, issue: 'Verified payment awaiting customer order creation' } });
  }
}
module.exports = { settle };
