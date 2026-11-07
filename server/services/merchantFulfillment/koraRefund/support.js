"use strict";
// Support primitives for the koraRefund gated command (workstream K): the
// result projection and the per-claim remainder guard. The original claim
// identity stays the immutable MarketplacePaymentClaim row; this remainder
// record conserves the refundable remainder so concurrent commands with
// DIFFERENT idempotency keys can never over-refund the original claim. The
// MerchantKoraRefundAllocation is the once-only command record: its _id IS
// the idempotency anchor (Phase A CheckoutDebit primitive).
const { ConflictError } = require("../../../utils/errors");
const Remainder = require("../../../models/MerchantKoraRefundRemainder");

const EXCEEDED =
  "Refund amount exceeds the remaining refundable amount of the original Korapay claim; the recorded claim amount requires reconciliation.";

// Rebuild the command result from the MerchantKoraRefundAllocation record
// alone — used for both the fresh outcome and the idempotent replay
// (identical shape).
function present(record, status) {
  return {
    status,
    state: record.state,
    claim: record.claim,
    providerReference: record.providerReference,
    receiptTransactionId: record.receiptTransactionId ?? null,
    fallbackAccepted: Boolean(record.fallbackAccepted),
    providerRefundId: record.providerRefundId ?? null,
    amountMinor: record.amountMinor,
    currency: record.currency,
    remainderMinor: record.remainderMinorAfter,
    issue: record.issue || null,
    feeTreatment: {
      state: record.feeBearerState,
      bearer: record.feeBearer ?? null,
      futureJournalTreatment: record.feeJournalTreatment ?? null,
      sourceVersion: record.feeTreatmentVersion ?? null,
    },
    policy: { id: record.policyId, version: record.policyVersion },
  };
}

// Explicit conservation evaluated BEFORE any mutation, plus the atomically
// conditional advance. Concurrent different-key commands can never over-refund.
async function advanceRemainder(claimId, originalMinor, amountMinor, session) {
  const filter = {
    _id: claimId,
    refundedMinor: { $lte: originalMinor - amountMinor },
  };
  const update = { $inc: { refundedMinor: amountMinor } };
  let row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
  if (row) return row;
  if (await Remainder.exists({ _id: claimId }).session(session))
    throw new ConflictError(EXCEEDED);
  try {
    return await Remainder.create(
      [{ _id: claimId, originalMinor, refundedMinor: amountMinor }],
      { session },
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
    if (!row) throw new ConflictError(EXCEEDED);
    return row;
  }
}

// Once-only settle evidence insert (`korapay:platform:<providerRefundId>`).
// Mongo's intrinsic _id index is the durable identity: a later/late
// confirmation of the same provider refund id can never insert again, and one
// id can never serve two allocations. Returns nothing; throws on a foreign
// allocation attempting to consume existing evidence.
async function settleEvidenceOnce(EvidenceModel, evidenceKey, detail, session) {
  const used = await EvidenceModel.findById(evidenceKey).session(session).lean();
  if (used) {
    if (String(used.allocation) !== String(detail.allocation))
      throw new ConflictError(
        "Provider refund evidence already used by another allocation",
      );
    return used;
  }
  try {
    return (
      await EvidenceModel.create(
        [
          {
            _id: evidenceKey,
            allocation: detail.allocation,
            order: detail.order,
            amountMinor: detail.amountMinor,
            currency: detail.currency,
          },
        ],
        { session },
      )
    )[0];
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A parallel confirmation may have inserted the same evidence for the
    // SAME allocation — replay-safe; foreign ids stay conflicts below.
    const again = await EvidenceModel.findById(evidenceKey).session(session).lean();
    if (!again || String(again.allocation) !== String(detail.allocation))
      throw new ConflictError(
        "Provider refund evidence already used by another allocation",
      );
    return again;
  }
}

module.exports = { present, advanceRemainder, settleEvidenceOnce, EXCEEDED };
