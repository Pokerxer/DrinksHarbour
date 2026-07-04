// server/services/giftCard.service.js
//
// The atomic DB layer for platform gift cards. Like wallet.service.js, every
// balance move is a guarded, atomic $inc paired with an append-only
// GiftCardTransaction row; the redeem guard (status active, unexpired, balance >=
// amount) lives in the Mongo filter so concurrent redemptions across channels
// (POS scan + online) can never overdraw or double-spend. The pure rules live in
// giftCard.helpers.js. The QR signing secret comes from GIFTCARD_QR_SECRET.

const crypto = require('crypto');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const {
  generateGiftCardCode,
  generateCardNumber,
  normalizeGiftCardCode,
  signGiftCardToken,
  validateGiftCardRedeem,
  computeStatusAfterRedeem,
  giftCardTierForAmount,
} = require('./giftCard.helpers');

const QR_SECRET = process.env.GIFTCARD_QR_SECRET || '';

/**
 * Activate a paid-for card: assign a unique code + signed QR, set balance to
 * initialAmount, flip pending_payment → active, append an 'issue' row. Idempotent:
 * a card already past pending_payment is returned unchanged (alreadyIssued:true).
 */
async function issueGiftCard({ giftCardId, paymentRef, createdBy }) {
  const card = await GiftCard.findById(giftCardId);
  if (!card) return { ok: false, status: 404, message: 'Gift card not found' };
  if (card.status !== 'pending_payment') {
    return { ok: true, card, alreadyIssued: true };
  }

  // Generate a code unique against existing cards (retry on the rare collision).
  let code = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generateGiftCardCode();
    const clash = await GiftCard.findOne({ code: candidate }).select('_id');
    if (!clash) { code = candidate; break; }
  }
  if (!code) return { ok: false, status: 500, message: 'Could not generate a unique gift-card code' };

  const nonce = crypto.randomBytes(8).toString('hex');
  const qrToken = signGiftCardToken({ gid: String(card._id), code, nonce }, QR_SECRET);

  card.code = code;
  card.cardNumber = generateCardNumber();
  card.qrToken = qrToken;
  card.balance = card.initialAmount;
  card.status = 'active';
  card.design = { ...(card.design?.toObject?.() ?? card.design ?? {}), tier: giftCardTierForAmount(card.initialAmount).id };
  if (paymentRef) card.paymentRef = paymentRef;

  // Generate a claim token so the buyer can share a gift link with the recipient.
  if (card.recipient?.email && !card.claimToken) {
    card.claimToken = crypto.randomUUID();
  }

  await card.save();

  await GiftCardTransaction.create({
    giftCardId: card._id,
    type: 'issue',
    amount: card.initialAmount,
    balanceAfter: card.balance,
    createdBy,
  });

  return { ok: true, card };
}

/**
 * Redeem `amount` off a card resolved by id or normalized code. The debit is an
 * atomic, guarded $inc (active + unexpired + sufficient balance enforced in the
 * filter), so concurrent redemptions can never overdraw. Flips status to
 * 'redeemed' when drained; undoes the debit if the ledger write fails.
 */
async function redeemGiftCard({
  giftCardId, code, amount, redeemedAtTenant, relatedOrder, createdBy, now = new Date(),
}) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, status: 400, message: 'Amount must be a positive integer' };
  }

  const base = giftCardId ? { _id: giftCardId } : { code: normalizeGiftCardCode(code) };
  const filter = {
    ...base,
    status: 'active',
    balance: { $gte: n },
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  };

  const updated = await GiftCard.findOneAndUpdate(filter, { $inc: { balance: -n } }, { new: true });
  if (!updated) {
    // Surface the specific reason (best-effort, non-atomic read after the miss).
    const snapshot = await GiftCard.findOne(base).select('status balance expiresAt');
    if (!snapshot) return { ok: false, status: 404, message: 'Gift card not found' };
    const check = validateGiftCardRedeem(snapshot, n, now);
    return { ok: false, status: 400, message: check.message || 'Gift card cannot be redeemed' };
  }

  const newStatus = computeStatusAfterRedeem(updated.balance);
  if (newStatus !== updated.status) {
    await GiftCard.updateOne({ _id: updated._id }, { $set: { status: newStatus } });
  }

  try {
    const tx = await GiftCardTransaction.create({
      giftCardId: updated._id,
      type: 'redeem',
      amount: n,
      balanceAfter: updated.balance,
      redeemedAtTenant: redeemedAtTenant || null,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.balance, tx, card: updated };
  } catch (err) {
    // Ledger write failed — restore balance and active status.
    await GiftCard.updateOne({ _id: updated._id }, { $inc: { balance: n }, $set: { status: 'active' } });
    throw err;
  }
}

/**
 * Credit `amount` back onto a card (sale reversal). Reactivates a 'redeemed' card.
 * Undoes the credit if the ledger write fails.
 */
async function refundGiftCard({ giftCardId, amount, relatedOrder, createdBy }) {
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, status: 400, message: 'Amount must be a positive integer' };
  }

  const updated = await GiftCard.findOneAndUpdate(
    { _id: giftCardId, status: { $in: ['active', 'redeemed'] } },
    { $inc: { balance: n }, $set: { status: 'active' } },
    { new: true }
  );
  if (!updated) return { ok: false, status: 404, message: 'Gift card not found' };

  try {
    const tx = await GiftCardTransaction.create({
      giftCardId: updated._id,
      type: 'refund',
      amount: n,
      balanceAfter: updated.balance,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.balance, tx, card: updated };
  } catch (err) {
    await GiftCard.updateOne({ _id: updated._id }, { $inc: { balance: -n } });
    throw err;
  }
}

module.exports = { issueGiftCard, redeemGiftCard, refundGiftCard };
