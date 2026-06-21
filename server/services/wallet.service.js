// server/services/wallet.service.js
//
// The one DB-aware mutation for a customer's stored-value wallet, shared by the
// Contacts admin endpoints (top-up / adjust) and the POS sale path (wallet tender
// / refund). The pure money rules live in contact.helpers.js (validateWalletTx /
// applyWalletDelta / summarizeWallet) and are unit-tested without Mongo; this file
// is the thin atomic layer that pairs them with the database.
//
// The authoritative balance lives on the owner record (POSCustomer.walletBalance
// or User.walletBalance). A balance move is a guarded, atomic $inc — for a debit
// the filter also requires `walletBalance >= amount`, so concurrent debits can
// never drive it negative — and the post-update balance is read straight back from
// the DB into the ledger row's `balanceAfter` (a client figure is never trusted).
// The ledger is append-only: reversals are new rows, never edits/deletes.

const WalletTransaction = require('../models/WalletTransaction');

/**
 * Atomically move a wallet balance and append the matching ledger row.
 *
 * @param {object}   args
 * @param {object}   args.owner  { Model, ownerType, ownerId, filter } — `filter`
 *   is a Mongo query selecting the owner doc and MUST NOT itself constrain
 *   `walletBalance` (the debit guard is added here).
 * @param {*}        args.tenantId
 * @param {object}   args.value  { type, amount, reason } (as from validateWalletTx).
 * @param {string}   [args.reference]     e.g. a receipt / return number.
 * @param {*}        [args.relatedOrder]  Order _id this tx relates to.
 * @param {*}        [args.createdBy]      acting User _id.
 * @returns {Promise<{ ok: true, balance: number, tx: object }
 *                  | { ok: false, status: number, message: string }>}
 */
async function mutateWallet({ owner, tenantId, value, reference, relatedOrder, createdBy }) {
  const { Model, ownerType, ownerId, filter } = owner;
  const { type, amount, reason } = value;
  const inc = type === 'debit' ? -amount : amount;

  const query = { ...filter };
  if (type === 'debit') query.walletBalance = { $gte: amount }; // atomic overdraw guard

  const updated = await Model.findOneAndUpdate(
    query,
    { $inc: { walletBalance: inc } },
    { new: true }
  ).select('walletBalance');

  if (!updated) {
    // Either the owner vanished, or (for a debit) the balance was insufficient.
    return {
      ok: false,
      status: type === 'debit' ? 400 : 404,
      message: type === 'debit' ? 'Insufficient wallet balance' : 'Wallet owner not found',
    };
  }

  try {
    const tx = await WalletTransaction.create({
      tenant: tenantId,
      ownerType,
      ownerId,
      type,
      amount,
      balanceAfter: updated.walletBalance,
      reason,
      reference,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.walletBalance, tx };
  } catch (err) {
    // Ledger write failed — undo the balance move to keep the two consistent.
    await Model.updateOne({ _id: updated._id }, { $inc: { walletBalance: -inc } });
    throw err;
  }
}

module.exports = { mutateWallet };
