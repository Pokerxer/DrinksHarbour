// server/controllers/wallet.controller.js
//
// Platform-wide customer wallet (the "Wallet" account page) — an NGN stored-value
// balance held on User.platformWalletBalance, distinct from the tenant store-credit
// wallet (WalletTransaction / wallet.service). Customers fund it via the active
// payment gateway (Korapay); the
// credit is applied only after a verified successful transaction, using the atomic
// mutatePlatformWallet service so the balance + append-only ledger stay consistent.
// All endpoints are self-scoped to req.user._id (JWT authority) — no cross-user access.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const User = require('../models/User');
const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');
const { mutatePlatformWallet } = require('../services/platformWallet.service');
const { summarizePlatformWallet } = require('../services/platformWallet.helpers');
const paymentService = require('../services/payment.service');
const emailService = require('../services/email.service');
const { frontendBaseUrl } = require('../utils/frontendUrl');

const MIN_FUND_AMOUNT = 500; // NGN — floor to keep gateway fees sane.
const MAX_FUND_AMOUNT = 10000000; // NGN — single-transaction ceiling (₦10M).

/**
 * Build the Mongo filter for a user's wallet-transaction query from optional
 * `type`/`from`/`to` request params. Unknown/invalid values are ignored.
 */
function buildTransactionFilter(userId, { type, from, to } = {}) {
  const filter = { userId };
  if (['credit', 'debit', 'refund', 'adjustment'].includes(type)) filter.type = type;
  const createdAt = {};
  if (from) { const d = new Date(from); if (!Number.isNaN(d.getTime())) createdAt.$gte = d; }
  if (to)   { const d = new Date(to);   if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); createdAt.$lte = d; } }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

/**
 * @desc    Get the authenticated customer's wallet balance + summary.
 * @route   GET /api/wallet
 * @access  Private (customer)
 */
const getWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('platformWalletBalance email firstName');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  // Latest transactions for the summary block (cheap; full list is paginated).
  const recent = await PlatformWalletTransaction.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const summary = summarizePlatformWallet(recent);

  successResponse(res, {
    balance: user.platformWalletBalance,
    currency: 'NGN',
    summary: { ...summary, count: undefined }, // count is approximate over the slice
    recent: recent.map(t => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      source: t.source,
      reason: t.reason,
      reference: t.reference,
      redeemedAtTenant: t.redeemedAtTenant,
      relatedOrder: t.relatedOrder,
      createdAt: t.createdAt,
    })),
  }, 'Wallet retrieved');
});

/**
 * @desc    Get paginated wallet transaction history for the authenticated customer.
 * @route   GET /api/wallet/transactions
 * @access  Private (customer)
 */
const getWalletTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = buildTransactionFilter(req.user._id, req.query);
  const [total, items] = await Promise.all([
    PlatformWalletTransaction.countDocuments(filter),
    PlatformWalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'redeemedAtTenant', select: 'name slug' })
      .lean(),
  ]);

  successResponse(res, {
    items: items.map(t => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      source: t.source,
      reason: t.reason,
      reference: t.reference,
      redeemedAtTenant: t.redeemedAtTenant,
      relatedOrder: t.relatedOrder,
      createdAt: t.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  }, 'Transactions retrieved');
});

/**
 * @desc    Initialize a gateway (Korapay) funding transaction for the wallet.
 * @route   POST /api/wallet/fund
 * @access  Private (customer)
 */
const fundWallet = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const n = Number(amount);
  if (!Number.isInteger(n) || n < MIN_FUND_AMOUNT || n > MAX_FUND_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Amount must be a whole number between ₦${MIN_FUND_AMOUNT} and ₦${MAX_FUND_AMOUNT.toLocaleString()}`,
    });
  }

  const user = await User.findById(req.user._id).select('email firstName');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const reference = `DHW-${user._id}-${Date.now()}`;
  const frontendUrl = frontendBaseUrl();
  const payment = await require('../services/storedValueFunding').initialize({ user: user._id, amount: n, reference,
    kind: 'wallet_fund', email: user.email, callbackUrl: `${frontendUrl}/my-account/wallet` });

  successResponse(res, {
    reference,
    authorizationUrl: payment.authorizationUrl,
    accessCode: payment.accessCode,
    amount: n,
    currency: 'NGN',
  }, 'Funding initialized');
});

/**
 * @desc    Verify a gateway (Korapay) funding transaction and credit the wallet.
 * @route   POST /api/wallet/fund/verify
 * @access  Private (customer)
 */
const verifyFundWallet = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  if (!reference) return res.status(400).json({ success: false, message: 'Reference is required' });

  const result = await require('../services/storedValueFunding').wallet(reference, req.user._id);
  successResponse(res, result, 'Wallet funded successfully');
});

// POST /api/wallet/pay — debit the wallet to pay for a checkout order
const payWithWallet = asyncHandler(async (req, res) => {
  const result = await require('../services/checkoutDebit').pay('wallet', req.user._id, req.body.amount, null, req.get('Idempotency-Key'));
  return successResponse(res, result, 'Wallet payment successful');
});

module.exports = {
  getWallet,
  getWalletTransactions,
  fundWallet,
  verifyFundWallet,
  buildTransactionFilter,
  payWithWallet,
};