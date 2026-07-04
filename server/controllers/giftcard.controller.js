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
const User = require('../models/User');
const {
  issueGiftCard,
  redeemGiftCard,
} = require('../services/giftCard.service');
const {
  validateGiftCardPurchase,
  formatGiftCardCode,
  formatCardNumber,
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
  const me = req.user._id;
  const cards = await GiftCard.find({
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).sort({ createdAt: -1 }).lean();

  successResponse(res, cards.map(c => {
    const isBuyer = String(c.purchasedBy) === String(me);
    return {
      _id: c._id,
      code: c.code ? formatGiftCardCode(c.code) : null,
      cardNumber: c.cardNumber ? formatCardNumber(c.cardNumber) : null,
      initialAmount: c.initialAmount,
      balance: c.balance,
      currency: c.currency,
      status: c.status,
      recipient: c.recipient,
      design: c.design,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      purchasedByMe: isBuyer,
      claimToken: isBuyer ? (c.claimToken || null) : undefined,
      claimedBy: c.claimedBy ? String(c.claimedBy) : null,
      claimedAt: c.claimedAt || null,
    };
  }), 'Gift cards retrieved');
});

/**
 * @desc    Get a single gift card (own only) + its transaction ledger.
 * @route   GET /api/gift-cards/:id
 * @access  Private (customer)
 */
const getGiftCard = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const card = await GiftCard.findOne({
    _id: req.params.id,
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).lean();
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
    cardNumber: card.cardNumber ? formatCardNumber(card.cardNumber) : null,
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
    purchasedByMe: String(card.purchasedBy) === String(me),
    claimToken: String(card.purchasedBy) === String(me) ? (card.claimToken || null) : undefined,
    claimedBy: card.claimedBy ? String(card.claimedBy) : null,
    claimedAt: card.claimedAt || null,
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
  const frontendUrl =
    process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  const payment = await paymentService.createPaystackTransaction(
    initialAmount,
    req.user.email,
    {
      kind: 'gift_card_purchase',
      giftCardId: String(card._id),
      userId: String(req.user._id),
      reference,
    },
    {
      // Reuse our reference and embed gc_id in the callback URL so Paystack echoes
      // it back on redirect — the frontend reads it from searchParams without needing
      // sessionStorage (which can silently fail in certain browsers/modes).
      reference,
      callbackUrl: `${frontendUrl}/my-account/gift-cards?gc_id=${card._id}`,
    },
  );

  // Persist the reference on the card so the complete-payment endpoint can retry
  // verification without the client needing to supply the original reference.
  await GiftCard.updateOne({ _id: card._id }, { paymentRef: reference });

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
 * @desc    Manually complete payment for a pending_payment gift card by re-checking
 *          its stored Paystack reference. Called when the automatic post-redirect
 *          verification fails (e.g. network drop, browser crash, popup blocker).
 * @route   POST /api/gift-cards/:id/complete-payment
 * @access  Private (customer)
 */
const completeGiftCardPayment = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id })
    .select('_id status paymentRef');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  if (card.status !== 'pending_payment') {
    return successResponse(res, { alreadyIssued: true, giftCardId: card._id }, 'Gift card already issued');
  }

  if (!card.paymentRef) {
    return res.status(400).json({ success: false, message: 'No payment reference on file — please contact support' });
  }

  const result = await paymentService.verifyPaystackTransaction(card.paymentRef);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message || 'Payment not confirmed by Paystack yet — please wait and try again' });
  }

  const issued = await issueGiftCard({ giftCardId: card._id, paymentRef: result.data.reference, createdBy: req.user._id });
  if (!issued.ok) return res.status(issued.status).json({ success: false, message: issued.message });

  successResponse(res, {
    giftCardId: card._id,
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

  const me = req.user._id;
  const card = await GiftCard.findOne({
    _id: req.params.id,
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).select('_id status balance code purchasedBy claimToken');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  // Buyer cannot redeem once the card has been designated as a gift.
  const isBuyer = String(card.purchasedBy) === String(me);
  if (isBuyer && card.claimToken) {
    return res.status(403).json({ success: false, message: 'This card has been gifted and cannot be redeemed by the buyer' });
  }

  // Idempotency: reject an accidental duplicate redeem of the same amount off the
  // same card within a short window (double-click / retry).
  const DUP_WINDOW_MS = 10000;
  const recentDup = await GiftCardTransaction.findOne({
    giftCardId: card._id,
    type: 'redeem',
    amount: n,
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  if (recentDup) {
    const fresh = await GiftCard.findById(card._id).select('balance status').lean();
    const u = await User.findById(req.user._id).select('platformWalletBalance').lean();
    return successResponse(res, {
      cardBalance: fresh.balance,
      cardStatus: fresh.status,
      walletBalance: u.platformWalletBalance,
      alreadyProcessed: true,
    }, 'Redemption already processed');
  }

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

// POST /api/gift-cards/pay-checkout — spend a gift card at checkout (any bearer with the code)
const payWithGiftCard = asyncHandler(async (req, res) => {
  const { code, amount } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Gift card code is required' });
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ success: false, message: 'Amount must be a positive integer' });

  const result = await redeemGiftCard({ code, amount: n, source: 'checkout', createdBy: req.user._id });
  if (!result.ok) return res.status(result.status || 400).json({ success: false, message: result.message });

  return successResponse(res, {
    cardBalance: result.balance,
    cardStatus: result.card.status,
    transactionId: result.tx?._id,
  }, 'Gift card payment successful');
});

// GET /api/gift-cards/check?code=XXX — check an active gift card balance (pre-flight)
const checkGiftCard = asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ success: false, message: 'Code is required' });
  const { normalizeGiftCardCode } = require('../services/giftCard.helpers');
  const card = await GiftCard.findOne({ code: normalizeGiftCardCode(code), status: 'active' }).select('balance cardNumber expiresAt');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found or not active' });
  return successResponse(res, { balance: card.balance, cardNumber: card.cardNumber ? formatCardNumber(card.cardNumber) : null, expiresAt: card.expiresAt });
});

/**
 * @desc    Public: look up a gift card by its claim token (no code/balance exposed).
 * @route   GET /api/gift-cards/claim/:token
 * @access  Public
 */
const getGiftCardByClaimToken = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ claimToken: req.params.token })
    .select('initialAmount currency design recipient claimedBy status')
    .lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift not found' });
  if (card.claimedBy) {
    return successResponse(res, { alreadyClaimed: true }, 'Gift already claimed');
  }
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'This gift card is no longer active' });
  }
  successResponse(res, {
    amount: card.initialAmount,
    currency: card.currency,
    tier: card.design?.tier || null,
    senderName: card.recipient?.name || null,
    message: card.recipient?.message || null,
    alreadyClaimed: false,
  }, 'Gift card info retrieved');
});

/**
 * @desc    Claim a gift card by token — links it to the authenticated user's account.
 * @route   POST /api/gift-cards/claim/:token
 * @access  Private (customer)
 */
const claimGiftCard = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ claimToken: req.params.token })
    .select('_id purchasedBy claimedBy status')
    .lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift not found' });
  if (card.claimedBy) {
    return res.status(400).json({ success: false, message: 'This gift has already been claimed' });
  }
  if (String(card.purchasedBy) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot claim your own gift card' });
  }
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'This gift card is no longer active' });
  }

  // Atomic update — only succeeds if still unclaimed (race-safe).
  const result = await GiftCard.updateOne(
    { _id: card._id, claimedBy: null },
    { $set: { claimedBy: req.user._id, claimedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    return res.status(400).json({ success: false, message: 'This gift has already been claimed' });
  }

  successResponse(res, { giftCardId: card._id }, 'Gift card claimed successfully');
});

/**
 * @desc    Send (or resend) a gift notification email for a card the buyer owns.
 *          Also works on self-bought cards that were not originally gifted.
 * @route   POST /api/gift-cards/:id/send-gift
 * @access  Private (buyer only)
 */
const sendGiftAsGift = asyncHandler(async (req, res) => {
  const { email, name, message } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid recipient email is required' });
  }

  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id });
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Only active cards can be gifted' });
  }
  if (card.claimedBy) {
    return res.status(400).json({ success: false, message: 'This card has already been claimed' });
  }

  // Reuse existing token on resend so old links stay valid.
  if (!card.claimToken) card.claimToken = require('crypto').randomUUID();

  card.recipient = {
    email: email.toLowerCase().trim(),
    name: name ? String(name).trim() : undefined,
    message: message ? String(message).trim().slice(0, 280) : undefined,
  };
  await card.save();

  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    if (emailService?.sendGiftCardEmail) {
      await emailService.sendGiftCardEmail(card.recipient.email, {
        amount: card.initialAmount,
        senderName: req.user.firstName,
        message: card.recipient.message,
        expiresAt: card.expiresAt,
        claimLink: `${frontendUrl}/gift/${card.claimToken}`,
      });
    }
  } catch { /* non-fatal */ }

  successResponse(res, {
    claimToken: card.claimToken,
    recipientEmail: card.recipient.email,
  }, 'Gift notification sent');
});

module.exports = {
  getMyGiftCards,
  getGiftCard,
  purchaseGiftCard,
  verifyPurchaseGiftCard,
  completeGiftCardPayment,
  redeemMyGiftCard,
  payWithGiftCard,
  checkGiftCard,
  getGiftCardByClaimToken,
  claimGiftCard,
  sendGiftAsGift,
};