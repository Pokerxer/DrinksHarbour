// server/services/platformWallet.service.js
//
// The atomic DB layer for the platform-wide wallet. Mirrors wallet.service.js
// (mutateWallet) exactly: a guarded, atomic $inc on User.platformWalletBalance —
// for a debit the filter requires `platformWalletBalance >= amount`, so concurrent
// debits can never drive it negative — paired with an append-only
// PlatformWalletTransaction row whose `balanceAfter` is read straight back from the
// DB. If the ledger write fails, the balance move is undone.

const User = require('../models/User');
const PlatformWalletTransaction = require('../models/PlatformWalletTransaction');

/**
 * Atomically move the platform wallet balance and append the matching ledger row.
 * @returns {Promise<{ ok:true, balance:number, tx:object } | { ok:false, status:number, message:string }>}
 */
async function mutatePlatformWallet({
  owner, value, redeemedAtTenant, reference, relatedOrder, paymentRef, createdBy,
}) {
  const { userId } = owner;
  const { type, amount, source, reason } = value;
  const inc = type === 'debit' ? -amount : amount;

  const query = { _id: userId };
  if (type === 'debit') query.platformWalletBalance = { $gte: amount }; // atomic overdraw guard

  const updated = await User.findOneAndUpdate(
    query,
    { $inc: { platformWalletBalance: inc } },
    { new: true }
  ).select('platformWalletBalance');

  if (!updated) {
    return {
      ok: false,
      status: type === 'debit' ? 400 : 404,
      message: type === 'debit' ? 'Insufficient platform wallet balance' : 'Wallet owner not found',
    };
  }

  try {
    const tx = await PlatformWalletTransaction.create({
      userId,
      type,
      amount,
      balanceAfter: updated.platformWalletBalance,
      redeemedAtTenant: redeemedAtTenant || null,
      source,
      reason: reason || '',
      reference,
      relatedOrder,
      paymentRef,
      createdBy,
    });
    return { ok: true, balance: updated.platformWalletBalance, tx };
  } catch (err) {
    // Ledger write failed — undo the balance move to keep the two consistent.
    await User.updateOne({ _id: updated._id }, { $inc: { platformWalletBalance: -inc } });
    throw err;
  }
}

module.exports = { mutatePlatformWallet };
