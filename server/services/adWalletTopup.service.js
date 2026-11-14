'use strict';
// server/services/adWalletTopup.service.js
// Settles a verified ad-wallet top-up into the tenant's prepaid ad wallet.
// Rides the existing Paystack seam: it verifies the reference itself through
// payment.service.verifyPaystackTransaction (never trusting a caller's copy of
// the result) and reads the tenant from the metadata stamped on the charge at
// initialize time (marketplacePaymentTrust.initialize) — never from any verify
// request. The transaction's user comes from the stored initialization claim
// (MarketplacePaymentClaim.user). Double-credit protection is
// adWallet.service.creditAdWallet's reference idempotency — this layer adds
// no second idempotency store.
// NEVER throws: a settlement failure must not fail the payment response or the
// webhook acknowledgement — it logs so the failure can be reconciled.
const paymentService = require('./payment.service');
const Claim = require('../models/MarketplacePaymentClaim');
const adWallet = require('./adWallet.service');

const settleAdWalletCredit = async (reference) => {
  try {
    if (typeof reference !== 'string' || !reference) return undefined;
    const result = await paymentService.verifyPaystackTransaction(reference);
    const data = result && result.data;
    if (!result || !result.success || !data) return undefined;
    const metadata = data.metadata || {};
    if (metadata.purpose !== 'ad_wallet') return undefined;
    const tenantId = metadata.tenantId;
    if (!tenantId) {
      console.error(`Ad wallet top-up ${reference}: charge metadata has no tenantId; not credited`);
      return undefined;
    }
    if (!Number.isInteger(data.amount) || data.amount < 1) {
      console.error(`Ad wallet top-up ${reference}: amount ${data.amount} is not a positive whole naira figure; not credited`);
      return undefined;
    }
    const claim = await Claim.findById(`paystack:platform:${reference}`).lean();
    if (!claim) {
      console.error(`Ad wallet top-up ${reference}: no initialization claim found; not credited`);
      return undefined;
    }
    return adWallet.creditAdWallet(tenantId, data.amount, {
      reference,
      reason: 'Ad wallet top-up',
      userId: claim.user,
    });
  } catch (error) {
    console.error(`Ad wallet top-up settlement failed for ${reference}: ${error && error.message}`);
    return undefined;
  }
};

module.exports = { settleAdWalletCredit };
