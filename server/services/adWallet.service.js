// server/services/adWallet.service.js
// Prepaid tenant advertising wallet. Append-only ledger (AdWalletTransaction)
// + atomic balance on Tenant.adWalletBalance — the same two-record pattern as
// the customer wallet (server/models/WalletTransaction.js header comment).
// Prepaid-only by agreement: debits cannot overdraw; the filter guard is the
// concurrency control, never a read-check-write.
const Tenant = require('../models/Tenant');
const AdWalletTransaction = require('../models/AdWalletTransaction');
const { ValidationError, NotFoundError } = require('../utils/errors');

const creditAdWallet = async (tenantId, amount, { reference, reason = '', userId } = {}) => {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new ValidationError('Amount must be a positive integer (NGN)');
  }
  if (reference) {
    const existing = await AdWalletTransaction.findOne({
      tenant: tenantId, type: 'credit', reference,
    });
    if (existing) return existing; // idempotent: Paystack verify may re-fire
  }
  const tenant = await Tenant.findOneAndUpdate(
    { _id: tenantId },
    { $inc: { adWalletBalance: amount } },
    { new: true }
  );
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  return AdWalletTransaction.create({
    tenant: tenantId,
    type: 'credit',
    amount,
    balanceAfter: tenant.adWalletBalance,
    reason: reason || 'Ad wallet top-up',
    reference: reference || undefined,
    createdBy: userId || undefined,
  });
};

const debitForClick = async (tenantId, campaignId, tariff) => {
  const tenant = await Tenant.findOneAndUpdate(
    { _id: tenantId, adWalletBalance: { $gte: tariff } },
    { $inc: { adWalletBalance: -tariff } },
    { new: true }
  );
  if (!tenant) return { ok: false, reason: 'insufficient_balance' };

  const tx = await AdWalletTransaction.create({
    tenant: tenantId,
    type: 'debit',
    amount: tariff,
    balanceAfter: tenant.adWalletBalance,
    reason: `Ad click charge — campaign ${campaignId}`,
    campaign: campaignId,
  });
  return { ok: true, tx };
};

const getWallet = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select('adWalletBalance').lean();
  return { balance: tenant?.adWalletBalance ?? 0 };
};

module.exports = { creditAdWallet, debitForClick, getWallet };
