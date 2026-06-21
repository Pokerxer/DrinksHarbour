// server/services/loyalty.service.js
//
// The one DB-aware mutation for a customer's loyalty-points balance, shared by the
// Contacts admin endpoints (award / adjust) and the POS sale path (earn / redeem /
// reverse). The pure points rules live in contact.helpers.js (validateLoyaltyTx /
// loyaltyDelta / summarizeLoyalty) and are unit-tested without Mongo; this file is
// the thin atomic layer that pairs them with the database.
//
// Loyalty is IN-STORE ONLY, so the authoritative balance always lives on the
// POSCustomer record (loyaltyPoints). A balance move is a guarded, atomic $inc — for
// a debit-direction transaction (a redeem/expiry, or a negative adjustment) the
// filter also requires `loyaltyPoints >= |delta|`, so concurrent debits can never
// drive it negative — and the post-update balance is read straight back from the DB
// into the ledger row's `balanceAfter` (a client figure is never trusted). The
// ledger is append-only: reversals are new rows, never edits/deletes.

const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const { loyaltyDelta } = require('./contact.helpers');

/**
 * Atomically move a loyalty-points balance and append the matching ledger row.
 *
 * @param {object}   args
 * @param {object}   args.owner  { Model, ownerType, ownerId, filter } — `filter` is a
 *   Mongo query selecting the owner doc and MUST NOT itself constrain `loyaltyPoints`
 *   (the debit guard is added here).
 * @param {*}        args.tenantId
 * @param {object}   args.value  { type, points, reason } (as from validateLoyaltyTx;
 *   `points` is a positive magnitude, or signed for an 'adjustment').
 * @param {string}   [args.reference]     e.g. a receipt / return number.
 * @param {*}        [args.relatedOrder]  Order _id this tx relates to.
 * @param {*}        [args.createdBy]      acting User _id.
 * @returns {Promise<{ ok: true, balance: number, tx: object }
 *                  | { ok: false, status: number, message: string }>}
 */
async function mutateLoyalty({ owner, tenantId, value, reference, relatedOrder, createdBy }) {
  const { Model, ownerType, ownerId, filter } = owner;
  const { type, points, reason } = value;
  const inc = loyaltyDelta(type, points);

  const query = { ...filter };
  if (inc < 0) query.loyaltyPoints = { $gte: -inc }; // atomic overdraw guard

  const updated = await Model.findOneAndUpdate(
    query,
    { $inc: { loyaltyPoints: inc } },
    { new: true }
  ).select('loyaltyPoints');

  if (!updated) {
    // Either the owner vanished, or (for a debit) the balance was insufficient.
    return {
      ok: false,
      status: inc < 0 ? 400 : 404,
      message: inc < 0 ? 'Insufficient loyalty points' : 'Loyalty owner not found',
    };
  }

  try {
    const tx = await LoyaltyTransaction.create({
      tenant: tenantId,
      ownerType,
      owner: ownerId,
      type,
      points,
      balanceAfter: updated.loyaltyPoints,
      reason,
      reference,
      relatedOrder,
      createdBy,
    });
    return { ok: true, balance: updated.loyaltyPoints, tx };
  } catch (err) {
    // Ledger write failed — undo the balance move to keep the two consistent.
    await Model.updateOne({ _id: updated._id }, { $inc: { loyaltyPoints: -inc } });
    throw err;
  }
}

module.exports = { mutateLoyalty };
