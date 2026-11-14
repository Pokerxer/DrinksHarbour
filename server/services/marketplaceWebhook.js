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
    // Manual (WhatsApp) orders settle through the invoice service: the payer
    // is a guest, so trust.attach's order.user === claim.user check does not
    // apply. Settlement still goes through gateway-verified evidence.
    if (order.source === 'manual') {
      return require('./whatsappOrderInvoice').settleFromWebhook(order, provider, reference);
    }
    await trust.attach(order, { method: provider, reference }, actor);
  } else {
    await Claim.updateOne({ _id: row._id, state: { $in: ['ready', 'uncertain', 'initializing'] } },
      { $set: { receipt: proof.receipt, issue: 'Verified payment awaiting customer order creation' } });
  }
}
module.exports = { settle };
