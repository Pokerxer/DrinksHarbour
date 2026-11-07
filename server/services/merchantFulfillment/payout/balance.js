"use strict";
// Balance guard ops (workstream P): the per-child conservation ledger of the
// statement-linked transferable base. Every mutation is a conditional
// server-side predicate against the CURRENT committed document — never a
// read-modify-write — so concurrent commands cannot over-consume:
//   transferredMinor + heldMinor + amount ≤ netMinor
const Balance = require("../../../models/MerchantPayoutBalance");
const { ConflictError } = require("../../../utils/errors");

// Insert-when-absent or lower the frozen net figure to the freshest
// statement net receivable (only ever downward — refunds and holds reduce
// the receivable; it never grows).
async function absorbNet(childId, netMinor, session) {
  if (!Number.isSafeInteger(netMinor) || netMinor < 0)
    throw new ConflictError(
      "Settlement statement net receivable figures require reconciliation.",
    );
  const existing = await Balance.findById(childId).session(session).lean();
  if (existing) {
    if (existing.netMinor > netMinor)
      await Balance.updateOne(
        { _id: childId, netMinor: { $gt: netMinor } },
        { $set: { netMinor } },
        { session },
      );
    return existing;
  }
  try {
    await Balance.create(
      [{ _id: childId, netMinor, heldMinor: 0, transferredMinor: 0 }],
      { session },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return Balance.findById(childId).session(session).lean();
}

async function consumed(childId, session) {
  const row = await Balance.findById(childId).session(session).lean();
  return {
    transferredMinor: row?.transferredMinor ?? 0,
    heldMinor: row?.heldMinor ?? 0,
  };
}

// Advance one counter by `amount` subject to the joint conservation
// predicate. Conditional findOneAndUpdate against the committed doc.
async function advance(action, childId, amount, netMinor, session) {
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw new ConflictError("Recorded payout amounts must be positive minor amounts");
  await absorbNet(childId, netMinor, session);
  const field = action === "transfer" ? "transferredMinor" : "heldMinor";
  const guard = await Balance.findOneAndUpdate(
    {
      _id: childId,
      $expr: {
        // Both counters plus the new amount must fit the net receivable —
        // whichever counter the amount lands in.
        $lte: [{ $add: ["$heldMinor", "$transferredMinor", amount] }, "$netMinor"],
      },
    },
    { $inc: { [field]: amount } },
    { returnDocument: 'after', session },
  );
  if (!guard)
    throw new ConflictError(
      `Recorded payout ${action} exceeds the remaining transferable receivable; contents require reconciliation before executing.`,
    );
  return guard;
}

module.exports = { absorbNet, consumed, advance };
