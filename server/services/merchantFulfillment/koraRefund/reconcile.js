"use strict";
// Kora refund RECONCILE command (workstream K): once-only settle of a
// reserved/uncertain allocation by its SAVED provider refund id (authenticated
// retrieval only — ids are never discovered or invented). Duplicate or late
// confirmation replays without new writes; the evidence id can never serve two
// allocations. Runs inside the caller's session when one is passed, otherwise
// inside its own transaction.
const mongoose = require("mongoose");
const MerchantKoraRefundPolicy = require("../../../models/MerchantKoraRefundPolicy");
const Allocation = require("../../../models/MerchantKoraRefundAllocation");
const Evidence = require("../../../models/MerchantKoraRefundEvidence");
const { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors");
const adapter = require("./adapter");
const { present } = require("./support");

const FLAG = "MERCHANT_KORA_REFUNDS_ENABLED";
const TENDER_REVIEW = "Original tender refund capability requires review.";

async function runReconcile(command, actor, session, transport) {
  const row = await Allocation.findById(command.allocationId).session(session);
  if (!row) throw new NotFoundError("Kora refund allocation not found");
  if (row.state === "settled") return present(row.toObject(), "already_settled");
  if (!["requested", "uncertain"].includes(row.state))
    throw new ConflictError("Provider refund requires reconciliation");
  const policy =
    (await MerchantKoraRefundPolicy.findById(row.policyId).session(session).lean()) ??
    (await require("./policy").active({ session }));
  if (!policy)
    throw new ConflictError("Recorded Kora refund policy requires reconciliation");
  const outcome = await adapter.verify({ policy, allocation: row.toObject() }, transport);
  if (outcome.status !== "success")
    throw new ConflictError(
      "Provider refund retrieval did not confirm settlement; the reservation stays held and requires reconciliation.",
    );
  // Once-only evidence insert (`korapay:platform:<providerRefundId>`).
  await require("./support").settleEvidenceOnce(
    Evidence,
    adapter.evidenceId(row.providerRefundId),
    { allocation: String(row._id), order: row.order, amountMinor: row.amountMinor, currency: row.currency },
    session,
  );
  row.state = "settled";
  row.issue = "";
  row.processedAt = new Date();
  await row.save({ session });
  return present(row.toObject(), "settled");
}

// The gated reconcile command: same gates as the refund command (platform
// admin, idempotent identification, default-off flag) with zero writes before
// them.
async function reconcileKorapay(command, actor, { session, transport } = {}) {
  require("../refundAuthority").platform(actor);
  if (typeof command?.allocationId !== "string" || !command.allocationId.trim())
    throw new ValidationError("The saved Kora refund allocation id is required for reconciliation");
  if (process.env[FLAG] !== "true") throw new ConflictError(TENDER_REVIEW);
  if (session) return runReconcile(command, actor, session, transport);
  const own = await mongoose.startSession();
  try {
    let result;
    await own.withTransaction(async () => {
      result = await runReconcile(command, actor, own, transport);
    });
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { reconcileKorapay };
