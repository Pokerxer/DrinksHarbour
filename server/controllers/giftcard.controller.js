// server/controllers/giftcard.controller.js
//
// Platform gift cards (the "Gift Cards" account page). A customer buys a card with
// a chosen amount (and optional recipient + design); payment is taken via Paystack;
// on verified payment the card is "issued" (assigned a unique code + signed QR,
// flipped pending_payment → active, balance set, 'issue' ledger row appended) by
// the atomic giftCard.service. Cards are usable at any tenant. All read endpoints
// are scoped to the authenticated customer's own cards.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const {
  issueGiftCard,
  redeemGiftCard,
} = require('../services/giftCard.service');
const {
  validateGiftCardPurchase,
  formatGiftCardCode,
  summarizeGiftCard,
} = require('../services/giftCard.helpers');
const paymentService = require('../services/payment.service');
const emailService = require('../services/email.service');
const QRCode = require('qrcode');

const MIN_AMOUNT = 1000; // NGN
const MAX_AMOUNT = 20000000; // NGN — ceiling for the top "Black" (≥₦5M) tier; Paystack/fraud sanity cap
const EXPIRY_MONTHS = 12;

/**
 * @desc    List the authenticated customer's purchased gift cards.
 * @route   GET /api/gift-cards
 * @access  Private (customer)
 */
const getMyGiftCards = asyncHandler(async (req, res) => {
  const cards = await GiftCard.find({ purchasedBy: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  successResponse(res, cards.map(c => ({
    _id: c._id,
    code: c.code ? formatGiftCardCode(c.code) : null,
    initialAmount: c.initialAmount,
    balance: c.balance,
    currency: c.currency,
    status: c.status,
    recipient: c.recipient,
    design: c.design,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
  })), 'Gift cards retrieved');
});

/**
 * @desc    Get a single gift card (own only) + its transaction ledger.
 * @route   GET /api/gift-cards/:id
 * @access  Private (customer)
 */
const getGiftCard = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id }).lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  // Render the signed QR token to a scannable image (owner-only; endpoint is scoped).
  let qrDataUrl = null;
  if (card.qrToken) {
    try { qrDataUrl = await QRCode.toDataURL(card.qrToken, { margin: 1, width: 240 }); }
    catch { qrDataUrl = null; }
  }

  const transactions = await GiftCardTransaction.find({ giftCardId: card._id })
    .sort({ createdAt: -1 })
    .lean();

  const summary = summarizeGiftCard(transactions);

  successResponse(res, {
    _id: card._id,
    code: card.code ? formatGiftCardCode(card.code) : null,
    initialAmount: card.initialAmount,
    balance: card.balance,
    currency: card.currency,
    status: card.status,
    recipient: card.recipient,
    design: card.design,
    expiresAt: card.expiresAt,
    createdAt: card.createdAt,
    qrToken: card.qrToken || null,
    qrDataUrl,
    summary,
    transactions: transactions.map(t => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      redeemedAtTenant: t.redeemedAtTenant,
      relatedOrder: t.relatedOrder,
      reference: t.reference,
      createdAt: t.createdAt,
    })),
  }, 'Gift card retrieved');
});

/**
 * @desc    Initialize a gift-card purchase (creates a pending_payment card and a
 *          Paystack transaction). The card is issued on payment verification.
 * @route   POST /api/gift-cards/purchase
 * @access  Private (customer)
 */
const purchaseGiftCard = asyncHandler(async (req, res) => {
  const validated = validateGiftCardPurchase(req.body);
  if (!validated.ok) return res.status(400).json({ success: false, message: validated.message });
  const { initialAmount, recipient, design } = validated.value;

  if (initialAmount < MIN_AMOUNT || initialAmount > MAX_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Gift card amount must be between ₦${MIN_AMOUNT.toLocaleString()} and ₦${MAX_AMOUNT.toLocaleString()}`,
    });
  }

  const card = await GiftCard.create({
    initialAmount,
    balance: 0,
    currency: 'NGN',
    status: 'pending_payment',
    purchasedBy: req.user._id,
    recipient: recipient || undefined,
    design: design || undefined,
    expiresAt: new Date(Date.now() + EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000),
  });

  const reference = `DHGC-${card._id}-${Date.now()}`;
  const payment = await paymentService.createPaystackTransaction(initialAmount, req.user.email, {
    kind: 'gift_card_purchase',
    giftCardId: String(card._id),
    userId: String(req.user._id),
    reference,
  });

  successResponse(res, {
    giftCardId: card._id,
    reference,
    authorizationUrl: payment.authorizationUrl,
    accessCode: payment.accessCode,
    amount: initialAmount,
    currency: 'NGN',
  }, 'Gift card purchase initialized');
});

/**
 * @desc    Verify a gift-card purchase payment and issue the card.
 * @route   POST /api/gift-cards/purchase/verify
 * @access  Private (customer)
 */
const verifyPurchaseGiftCard = asyncHandler(async (req, res) => {
  const { reference, giftCardId } = req.body;
  if (!reference || !giftCardId) {
    return res.status(400).json({ success: false, message: 'Reference and giftCardId are required' });
  }

  // Ownership: the card must belong to the authenticated user.
  const card = await GiftCard.findOne({ _id: giftCardId, purchasedBy: req.user._id }).select('_id status');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });
  if (card.status !== 'pending_payment') {
    return successResponse(res, { alreadyIssued: true, giftCardId }, 'Gift card already issued');
  }

  const result = await paymentService.verifyPaystackTransaction(reference);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message || 'Payment verification failed' });
  }

  const issued = await issueGiftCard({ giftCardId, paymentRef: result.data.reference, createdBy: req.user._id });
  if (!issued.ok) return res.status(issued.status).json({ success: false, message: issued.message });

  // Best-effort delivery email to recipient (or buyer) — never blocks the response.
  try {
    const full = await GiftCard.findById(giftCardId).lean();
    const to = full?.recipient?.email || req.user.email;
    if (to && emailService?.sendGiftCardEmail) {
      await emailService.sendGiftCardEmail(to, {
        code: formatGiftCardCode(full.code),
        amount: full.initialAmount,
        senderName: req.user.firstName,
        message: full?.recipient?.message,
        expiresAt: full.expiresAt,
      });
    }
  } catch { /* non-fatal */ }

  successResponse(res, {
    giftCardId,
    code: formatGiftCardCode(issued.card.code),
    balance: issued.card.balance,
    status: issued.card.status,
  }, 'Gift card issued successfully');
});

/**
 * @desc    Redeem a gift card the customer owns into their platform wallet.
 *          Moves value card → wallet atomically; on a full drain the card flips
 *          to 'redeemed'. Redeeming into the wallet (vs spending at checkout) is
 *          the simplest, safest customer flow and keeps settlement simple.
 * @route   POST /api/gift-cards/:id/redeem
 * @access  Private (customer)
 */
const redeemMyGiftCard = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive whole number' });
  }

  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id }).select('_id status balance code');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  // Debit the card.
  const debited = await redeemGiftCard({ giftCardId: card._id, amount: n, createdBy: req.user._id });
  if (!debited.ok) return res.status(debited.status).json({ success: false, message: debited.message });

  // Credit the platform wallet for the same amount.
  const { mutatePlatformWallet } = require('../services/platformWallet.service');
  const credited = await mutatePlatformWallet({
    owner: { userId: req.user._id },
    value: { type: 'credit', amount: n, source: 'adjustment', reason: `Gift card ${formatGiftCardCode(card.code)} redeemed` },
    reference: `giftcard-${card._id}`,
    createdBy: req.user._id,
  });
  if (!credited.ok) {
    // Undo the card debit if the wallet credit failed — never lose money.
    await require('../services/giftCard.service').refundGiftCard({ giftCardId: card._id, amount: n, createdBy: req.user._id });
    return res.status(credited.status).json({ success: false, message: credited.message });
  }

  successResponse(res, {
    cardBalance: debited.balance,
    cardStatus: debited.card.status,
    walletBalance: credited.balance,
  }, 'Gift card redeemed to wallet');
});

module.exports = {
  getMyGiftCards,
  getGiftCard,
  purchaseGiftCard,
  verifyPurchaseGiftCard,
  redeemMyGiftCard,
};