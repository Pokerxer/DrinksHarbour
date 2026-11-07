"use strict";
// Once-only authenticated provider payout evidence RECONCILIATION (workstream
// P, uncertainty half of the transfer lifecycle). A provider report never
// becomes a financial fact: the recorded evidence row (MerchantPayoutEvidence)
// IS the authenticated fact, `_id = provider:account:transferId`, so
// duplicate or late provider confirmations can never replicate a settlement.
// Consumption of the statement-linked base is claimed by the execution path
// or — if the transfer reached `executing` without a claim — by the first
// settle path attempt, always subject to the same conservation predicate.
// The settle-path claim + once-only evidence insert + settlement stamp run
// inside ONE session transaction (the payout/holds.js run pattern): the
// balanceClaimedMinor stamp commits atomically with the balance advance, so
// no concurrent reconcile can read a half-claimed transfer, and a losing
// duplicate aborts with ZERO writes and replays through the module's
// explicit once-only semantics — a raw E11000 never surfaces.
const mongoose = require("mongoose");
const { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors");
const Transfer = require("../../../models/MerchantPayoutTransfer");
const Evidence = require("../../../models/MerchantPayoutEvidence");
const balance = require("./balance");
const { present, assertOperator, assertPolicy, resolveTransfer, PAYOUT_REASON } = require("./support");

async function startReplay(row) {
  const current = await Transfer.findById(row._id).lean();
  return present(current, "already_reconciled");
}

// One transaction: claim check → conditional conservation advance + claim
// stamp (atomic) → once-only evidence anchor → settlement stamp → audit. Any
// refusal inside aborts the whole write set (zero writes).
async function runReconcile(row, evidenceId, actor, policy, session) {
  const fresh = await Transfer.findById(row._id).session(session).lean();
  const existing = await Evidence.findById(evidenceId).session(session).lean();
  if (existing && existing.transfer !== row._id)
    throw new ConflictError(
      "This provider payout transfer evidence is already recorded for a different payout transfer; duplicate or late confirmations cannot reconcile again.",
    );
  if (existing && fresh.state === "settled")
    return startReplay(fresh);
  if (!existing && fresh.state === "settled")
    throw new ConflictError(
      "Only an executing or uncertain payout transfer can reconcile; settled transfers cannot reconcile again.",
    );
  if (!["executing", "uncertain"].includes(fresh.state))
    throw new ConflictError(
      "Only an executing or uncertain payout transfer can reconcile; the recorded payout transfer states require review.",
    );
  // Settle-path consumption claims the FIRST consumption only (no double):
  // the execution path already claimed a consumption atomically with its
  // advance; if it did not (returned executing without claim), the settle
  // path claims it subject to the same conservation predicate, and that
  // claim stamp itself commits atomically with the advance.
  if ((fresh.balanceClaimedMinor ?? 0) < fresh.amountMinor) {
    const { base, available } = await resolveTransfer(row.child, actor, policy);
    if (row.amountMinor > available)
      throw new ConflictError(
        "Settling this payout transfer would exceed the remaining transferable receivable; contents require reconciliation before executing.",
      );
    await balance.advance(
      "transfer",
      row.child,
      row.amountMinor,
      base.standingNetMinor,
      session,
    );
    const stamped = await Transfer.updateOne(
      { _id: row._id, state: { $in: ["executing", "uncertain"] } },
      { $set: { balanceClaimedMinor: row.amountMinor } },
      { session },
    );
    if (!stamped.acknowledged || stamped.matchedCount !== 1)
      throw new ConflictError(
        "Payout transfer execution is once-only; the transfer is already executing or has reached a terminal state.",
      );
  }
  const evidence = (
    await Evidence.create(
      [
        {
          _id: evidenceId,
          transfer: row._id,
          order: row.order,
          tenant: row.tenant,
          amountMinor: row.amountMinor,
          currency: row.currency,
          recordedBy: actor._id,
        },
      ],
      { session },
    )
  )[0];
  // The evidence must reconcile with the TRANSFER's recorded figures (the
  // sessioned read of the immutable transfer row), not merely with the row
  // the evidence creation itself produced.
  if (evidence.amountMinor !== fresh.amountMinor || evidence.currency !== fresh.currency)
    throw new ConflictError(
      "The recorded provider transfer evidence does not reconcile with the recorded payout transfer amount and currency; the evidence requires review.",
    );
  const settledNow = await Transfer.findOneAndUpdate(
    { _id: row._id, state: { $in: ["executing", "uncertain"] } },
    { $set: { state: "settled", settledEvidence: evidenceId } },
    { returnDocument: "after", session },
  );
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_PAYOUT_EVIDENCE_RECORD",
        actionCategory: "create",
        targetType: "MerchantPayoutTransfer",
        targetId: row.order,
        targetTenantId: row.tenant,
        justification: "Authenticated provider payout transfer evidence recorded",
        changes: { after: { transfer: row._id, evidenceId, amountMinor: row.amountMinor } },
      },
    ],
    { session },
  );
  if (!settledNow) return startReplay(fresh);
  return present(settledNow, "reconciled");
}

async function reconcile(command, actor) {
  assertOperator(actor);
  const row = await Transfer.findById(String(command?.transferId || "")).lean();
  if (!row) throw new NotFoundError("Merchant payout transfer not found");
  const provider = String(command.provider || ""),
    account = String(command.account || ""),
    providerTransferId = String(command.providerTransferId || "");
  if (
    !/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(provider) ||
    !/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(account) ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(providerTransferId)
  )
    throw new ValidationError(
      "Authenticated provider payout evidence requires provider, account and provider transfer identity components",
    );
  const evidenceId = `${provider}:${account}:${providerTransferId}`;
  if (row.submittedTransferId && row.submittedTransferId !== providerTransferId)
    throw new ConflictError(
      "The authenticated provider transfer identity does not match the submitted identity recorded on the payout transfer; the outcome requires reconciliation review.",
    );
  // Fast-path once-only checks: an evidence row already bound to ANOTHER
  // recorded transfer refuses reconciliation; an evidence row that already
  // settled THIS transfer replays write-free (duplicate/late confirmation
  // cannot replicate a settlement). The transaction re-checks both for the
  // concurrent case.
  const existing = await Evidence.findById(evidenceId).lean();
  if (existing && existing.transfer !== row._id)
    throw new ConflictError(
      "This provider payout transfer evidence is already recorded for a different payout transfer; duplicate or late confirmations cannot reconcile again.",
    );
  if (!existing && row.state === "settled")
    throw new ConflictError(
      "Only an executing or uncertain payout transfer can reconcile; settled transfers cannot reconcile again.",
    );
  if (existing && row.state === "settled") return startReplay(row);
  if (!["executing", "uncertain"].includes(row.state))
    throw new ConflictError(
      "Only an executing or uncertain payout transfer can reconcile; the recorded payout transfer states require review.",
    );
  const policy = await assertPolicy();
  const own = await mongoose.startSession();
  try {
    let result;
    try {
      await own.withTransaction(async () => {
        result = await runReconcile(row, evidenceId, actor, policy, own);
      });
    } catch (error) {
      // A parallel reconcile won the once-only evidence identity (raw E11000
      // beneath the transaction): its transaction already committed the
      // claim, settlement and audit together, so the loser reconciles as a
      // WRITE-FREE replay of the module's explicit once-only semantics — the
      // duplicate-key error itself never surfaces. Transient write conflicts
      // (a racing claim on the same balance row) are retried by the driver's
      // withTransaction before they ever reach this catch.
      if (error.code === 11000) {
        const replayed = await Evidence.findById(evidenceId).lean();
        const current = await Transfer.findById(row._id).lean();
        if (replayed && String(replayed.transfer) === String(row._id))
          return present(current, "already_reconciled");
      }
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { reconcile };
module.exports.PAYOUT_REASON = PAYOUT_REASON;
