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
 * Resolve a loyalty redemption request into the points actually consumed and the
 * ₦ value they buy, capped by `loyaltyMaxRedemptionPct` of the order total (and
 * never exceeding the total). Pure; no DB.
 */
function computeRedemption(points, posSettings, orderTotal) {
  if (!posSettings?.loyaltyEnabled) return { pointsRedeemed: 0, value: 0 };
  const pointValue = Number(posSettings.loyaltyPointsValue) || 0;
  const reqPoints = Math.max(0, Math.floor(Number(points) || 0));
  if (pointValue <= 0 || reqPoints <= 0) return { pointsRedeemed: 0, value: 0 };

  const total = Math.max(0, Number(orderTotal) || 0);
  const pct = Number(posSettings.loyaltyMaxRedemptionPct);
  const cap = pct > 0 ? Math.min(total, Math.floor((total * pct) / 100)) : total;
  const pointsRedeemed = Math.min(reqPoints, Math.floor(cap / pointValue));
  return { pointsRedeemed, value: Math.floor(pointsRedeemed * pointValue) };
}

/**
 * Capture payment for the FULL order total at confirm. Wallet tender is charged
 * via mutateWallet (atomic, guarded); on failure returns ok:false WITHOUT
 * mutating the order. Loyalty is earned on the paid amount. Wallet/loyalty deps
 * are injected for testability.
 */
async function capturePayment({
  salesOrder, tenantId, paymentMethod, amountTendered = 0, splitPayments = [],
  redeemPoints = 0, userId, posSettings = {},
  deps = {},
}) {
  const mutateWallet = deps.mutateWallet || require('./wallet.service').mutateWallet;
  const mutateLoyalty = deps.mutateLoyalty || require('./loyalty.service').mutateLoyalty;
  const total = Number(salesOrder.total) || 0;
  const customerId = salesOrder.customer || salesOrder.customerSnapshot?.customerId || null;
  const ownerOf = () => ({
    Model: POSCustomer, ownerType: 'POSCustomer', ownerId: customerId,
    filter: { _id: customerId, tenant: tenantId },
  });
  const reference = String(salesOrder.soNumber || salesOrder._id);

  // Loyalty redemption reduces the amount due. Resolve it first, then redeem the
  // points BEFORE charging money so a redeem failure aborts before any tender.
  const { pointsRedeemed, value: redeemValue } =
    customerId ? computeRedemption(redeemPoints, posSettings, total) : { pointsRedeemed: 0, value: 0 };
  if (pointsRedeemed > 0 && !customerId) {
    return { ok: false, status: 400, message: 'Point redemption requires a saved customer' };
  }
  if (pointsRedeemed > 0) {
    try {
      await mutateLoyalty({
        owner: ownerOf(), tenantId,
        value: { type: 'redeem', points: pointsRedeemed, reason: `Sales order — ${reference}` },
        reference, createdBy: userId,
      });
    } catch (e) {
      return { ok: false, status: 409, message: `Point redemption failed: ${e.message}` };
    }
  }

  const amountDue = Math.max(0, total - redeemValue);

  let walletTx = null;
  if (paymentMethod === 'wallet' && amountDue > 0) {
    if (!customerId) return { ok: false, status: 400, message: 'Wallet payment requires a saved customer' };
    const walletResult = await mutateWallet({
      owner: ownerOf(), tenantId,
      value: { type: 'debit', amount: amountDue, reason: `Sales order — ${reference}` },
      reference, createdBy: userId,
    });
    if (!walletResult.ok) {
      // Money never moved — reverse the redemption so the points aren't lost.
      if (pointsRedeemed > 0) {
        try {
          await mutateLoyalty({
            owner: ownerOf(), tenantId,
            value: { type: 'earn', points: pointsRedeemed, reason: `Reversal — ${reference}` },
            reference, createdBy: userId,
          });
        } catch (_) { /* best-effort reversal */ }
      }
      return { ok: false, status: walletResult.status === 404 ? 404 : 409, message: walletResult.message };
    }
    walletTx = walletResult.tx || null;
  }

  // Loyalty earn on the paid (money) amount, not the redeemed portion (best-effort;
  // a loyalty failure does not reverse the payment).
  let loyaltyEarned = 0;
  if (customerId) {
    loyaltyEarned = computeLoyaltyEarned(amountDue, posSettings);
    if (loyaltyEarned > 0) {
      try {
        await mutateLoyalty({
          owner: ownerOf(), tenantId,
          value: { type: 'earn', points: loyaltyEarned, reason: `Sales order — ${reference}` },
          reference, createdBy: userId,
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  return { ok: true, walletTx, loyaltyEarned, loyaltyRedeemed: redeemValue, pointsRedeemed };
}

module.exports = { computeLoyaltyEarned, computeRedemption, capturePayment };
