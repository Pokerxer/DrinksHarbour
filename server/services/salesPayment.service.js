// server/services/salesPayment.service.js
const POSCustomer = require('../models/POSCustomer');

/** Loyalty points earned for a paid amount, per tenant POS settings. */
function computeLoyaltyEarned(amount, posSettings) {
  if (!posSettings?.loyaltyEnabled) return 0;
  const rate = Number(posSettings.loyaltyPointsPerNaira) || 0;
  if (rate <= 0) return 0;
  return Math.floor(amount * rate);
}

/**
 * Capture payment for the FULL order total at confirm. Wallet tender is charged
 * via mutateWallet (atomic, guarded); on failure returns ok:false WITHOUT
 * mutating the order. Loyalty is earned on the paid amount. Wallet/loyalty deps
 * are injected for testability.
 */
async function capturePayment({
  salesOrder, tenantId, paymentMethod, amountTendered = 0, splitPayments = [],
  userId, posSettings = {},
  deps = {},
}) {
  const mutateWallet = deps.mutateWallet || require('./wallet.service').mutateWallet;
  const mutateLoyalty = deps.mutateLoyalty || require('./loyalty.service').mutateLoyalty;
  const total = Number(salesOrder.total) || 0;
  const customerId = salesOrder.customer || salesOrder.customerSnapshot?.customerId || null;

  let walletTx = null;
  if (paymentMethod === 'wallet' && total > 0) {
    if (!customerId) return { ok: false, status: 400, message: 'Wallet payment requires a saved customer' };
    const walletResult = await mutateWallet({
      owner: { Model: POSCustomer, ownerType: 'POSCustomer', ownerId: customerId, filter: { _id: customerId, tenant: tenantId } },
      tenantId,
      value: { type: 'debit', amount: total, reason: `Sales order — ${salesOrder.soNumber || salesOrder._id}` },
      reference: String(salesOrder.soNumber || salesOrder._id),
      createdBy: userId,
    });
    if (!walletResult.ok) {
      return { ok: false, status: walletResult.status === 404 ? 404 : 409, message: walletResult.message };
    }
    walletTx = walletResult.tx || null;
  }

  // Loyalty earn on the paid amount (best-effort; a loyalty failure does not
  // reverse the payment — points can be reconciled, money has changed hands).
  let loyaltyEarned = 0;
  if (customerId) {
    loyaltyEarned = computeLoyaltyEarned(total, posSettings);
    if (loyaltyEarned > 0) {
      try {
        await mutateLoyalty({
          owner: { Model: POSCustomer, ownerType: 'POSCustomer', ownerId: customerId, filter: { _id: customerId, tenant: tenantId } },
          tenantId,
          value: { type: 'earn', points: loyaltyEarned, reason: `Sales order — ${salesOrder.soNumber || salesOrder._id}` },
          reference: String(salesOrder.soNumber || salesOrder._id),
          createdBy: userId,
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  return { ok: true, walletTx, loyaltyEarned };
}

module.exports = { computeLoyaltyEarned, capturePayment };
