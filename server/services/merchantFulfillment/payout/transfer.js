"use strict";
// Gated statement-linked payout transfer COMMAND (workstream P). The payout
// contract (recorded, immutable policy version) + default-off
// MERCHANT_PAYOUT_TRANSFERS_ENABLED flag + a reconciled settlement statement
// + a recorded review are ALL required; any missing piece refuses with the
// verbatim recorded payout posture — "No payout execution exists; payout
// policy requires review." — and zero writes. The amount binds exactly to
// the READ-ONLY settlement statement projection (settlement/statement.js,
// read-import UNMODIFIED): transferable base = statement net receivable −
// recorded holds, conserved against the MerchantPayoutBalance guard.
// Once-only lifecycle: prepared → reviewed → executing → settled | uncertain;
// uncertainty reconciliation lives in payout/evidence.js (once-only
// authenticated provider evidence). The sealed transport's provider report
// only stamps the submitted identity; it is never a financial fact.
const { ConflictError, NotFoundError } = require("../../../utils/errors");
const mongoose = require("mongoose");
const Transfer = require("../../../models/MerchantPayoutTransfer");
const Child = require("../../../models/MerchantOrder");
const fx = require("./fx");
const transport = require("./transport");
const balance = require("./balance");
const {
  PAYOUT_REASON,
  key,
  present,
  assertOperator,
  assertFlag,
  assertPolicy,
  assertCommand,
  resolveTransfer,
  figures,
  childOrNotFound,
} = require("./support");

async function runPrepare(command, actor) {
  const policy = await assertPolicy();
  const childId = String(command.childId);
  const child = await childOrNotFound(childId);
  const { base, available } = await resolveTransfer(childId, actor, policy);
  if (command.amountMinor > available)
    throw new ConflictError(
      `Payout amount exceeds the remaining transferable receivable (${available} minor) for the linked settlement statement; conservation requires a smaller amount.`,
    );
  const conversion = await fx.snapshot(base.currency, child.tenant, command.amountMinor, policy);
  const anchor = (
    await Transfer.create([
      {
        _id: key(childId, command.idempotencyKey),
        child: childId,
        order: child.order,
        tenant: child.tenant,
        currency: base.currency,
        amountMinor: command.amountMinor,
        destinationAccountReference: command.destinationAccountReference.trim(),
        statementVersion: base.statement.statementVersion,
        netReceivableMinor: base.netMinor,
        heldTotalMinor: base.heldTotalMinor,
        transferableBaseMinor: base.transferableBaseMinor,
        sourceFigures: figures(base.statement, base),
        policyId: policy._id,
        policyVersion: policy.version,
        policySnapshot: {
          scheduleRule: policy.scheduleRule,
          currencyMode: policy.currencyMode,
          destinationAccountSource: policy.destinationAccountSource,
          holdRegime: policy.holdRegime,
          standingHoldMinor: policy.standingHoldMinor ?? null,
          clawbackRule: policy.clawbackRule,
          nettingRule: policy.nettingRule,
          minimumThresholdMinor: policy.minimumThresholdMinor,
          destinationCurrency: policy.destinationCurrency ?? null,
        },
        destinationAccountSource: policy.destinationAccountSource,
        conversion,
        createdBy: actor._id,
      },
    ])
  )[0];
  return present(anchor, "prepared");
}

// Once-only preparation: the anchor _id IS the child-scoped idempotency key,
// so concurrent duplicate commands resolve to exactly one record on real
// Promise.all; a replay is write-free and result-identical.
async function prepare(command, actor) {
  assertOperator(actor);
  assertCommand(command);
  assertFlag();
  const childId = String(command.childId);
  const prior = await Transfer.findById(key(childId, command.idempotencyKey)).lean();
  if (prior) return present(prior, "already_prepared");
  try {
    return await runPrepare(command, actor);
  } catch (error) {
    // A parallel request may have won the idempotency anchor; replay once so
    // concurrent duplicates both resolve (one prepared, one already_prepared).
    if (error.code === 11000) {
      const winner = await Transfer.findById(key(childId, command.idempotencyKey)).lean();
      if (winner) return present(winner, "already_prepared");
    }
    throw error;
  }
}

// Recorded review: a prepared transfer becomes executable only after an
// explicit platform review stamp. Review is once per decision.
async function markReviewed(transferId, actor) {
  assertOperator(actor);
  const settled = await Transfer.findOneAndUpdate(
    { _id: String(transferId), state: "prepared" },
    { $set: { state: "reviewed", reviewedBy: actor._id, reviewedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!settled) {
    const row = await Transfer.findById(String(transferId)).lean();
    if (!row) throw new NotFoundError("Merchant payout transfer not found");
    throw new ConflictError(
      "Only a prepared payout transfer can be reviewed; the review is once per recorded decision.",
    );
  }
  return present(settled, "reviewed");
}

async function execute(transferId, actor) {
  assertOperator(actor);
  assertFlag();
  const row = await Transfer.findById(String(transferId)).lean();
  if (!row) throw new NotFoundError("Merchant payout transfer not found");
  const policy = await assertPolicy();
  if (row.state !== "reviewed")
    throw new ConflictError(
      "Only a reviewed payout transfer can execute; payout execution is once-only and uncertainty is reserved.",
    );
  // Claim the executing state FIRST — the once-only gate for execution and
  // balance consumption (concurrent executes refuse with the explicit
  // once-only reason and never submit twice).
  const claimed = await Transfer.findOneAndUpdate(
    { _id: row._id, state: "reviewed" },
    { $set: { state: "executing" } },
    { returnDocument: "after" },
  );
  if (!claimed)
    throw new ConflictError(
      "Payout transfer execution is once-only; the transfer is already executing or has reached a terminal state.",
    );
  let base;
  // The balance advance and the balanceClaimedMinor claim stamp are two
  // writes on two collections — unsessioned they left a two-write window in
  // which a concurrent reconciliation could read a claimed-but-not-stamped
  // transfer and re-run the settle-path claim. The advance + claim stamp now
  // commit inside ONE session transaction (the payout/holds.js run
  // pattern): transaction-atomic, so a concurrent duplicate sees either both
  // or neither, per-transfer conservation is preserved (global base
  // unchanged), and a refusing or conflicted claim aborts with zero writes.
  // The sealed
  // transport stays strictly OUTSIDE the transaction — no provider call ever
  // holds a session open.
  const own = await mongoose.startSession();
  try {
    await own.withTransaction(async () => {
      const resolution = await resolveTransfer(row.child, actor, policy);
      base = resolution.base;
      if (row.amountMinor > resolution.available)
        throw new ConflictError(
          "Payout transfer exceeds the remaining transferable receivable; contents require reconciliation before executing.",
        );
      await balance.advance(
        "transfer",
        row.child,
        row.amountMinor,
        base.standingNetMinor,
        own,
      );
      const stamped = await Transfer.updateOne(
        { _id: row._id, state: "executing" },
        { $set: { balanceClaimedMinor: row.amountMinor } },
        { session: own },
      );
      if (!stamped.acknowledged || stamped.matchedCount !== 1)
        throw new ConflictError(
          "The payout transfer executing claim requires reconciliation review.",
        );
    });
  } catch (error) {
    // The transaction aborted (conservation refusal, claim-stamp mismatch or
    // a transient write conflict) — zero balance writes persisted, so the
    // responsibility reservation itself is reverted to reviewed with the
    // recorded reason, exactly like the pre-transaction refusal semantics.
    await Transfer.updateOne(
      { _id: row._id, state: "executing" },
      { $set: { state: "reviewed", lastError: error.message, lastErrorAt: new Date() } },
    );
    throw error;
  } finally {
    await own.endSession();
  }
  const payload = {
    kind: "payout_transfer",
    transferId: row._id,
    order: String(row.order),
    child: row.child,
    tenant: String(row.tenant),
    amountMinor: row.amountMinor,
    currency: row.currency,
    destinationAccountReference: row.destinationAccountReference,
    netReceivableMinor: base.netMinor,
    heldTotalMinor: base.heldTotalMinor,
    statementVersion: base.statement.statementVersion,
    scheduleRule: policy.scheduleRule,
    nettingRule: policy.nettingRule,
    policyVersion: policy.version,
    executionOf: {
      amountMinor: row.amountMinor,
      statementVersion: row.statementVersion,
      sourceFigures: row.sourceFigures,
    },
  };
  let report;
  try {
    report = await transport.submit(payload);
  } catch (error) {
    // The transport refused before any movement: responsibility stays
    // reserved on the executing transfer; uncertainty reconciliation via
    // provider evidence remains the only settle path (no release policy).
    await Transfer.updateOne(
      { _id: row._id, state: "executing" },
      { $set: { lastError: error.message, lastErrorAt: new Date() } },
    );
    throw error;
  }
  if (report?.id !== undefined && report.id !== null) {
    const identity = String(report.id);
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(identity))
      throw new ConflictError(
        "The provider transfer identity is not representable; payout reconciliation requires review.",
      );
    // The provider report is only identity data; the transfer reserves as
    // uncertain — only authenticated evidence settles (payout/evidence.js).
    await Transfer.updateOne(
      { _id: row._id, state: "executing" },
      { $set: { state: "uncertain", submittedTransferId: identity } },
    );
  }
  const outcome = await Transfer.findById(row._id).lean();
  return present(outcome, outcome.state === "uncertain" ? "uncertain" : outcome.state);
}

async function list(childId, actor) {
  assertOperator(actor);
  const child = await childOrNotFound(String(childId));
  const rows = await Transfer.find({ child: String(child._id) })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return rows.map((row) => present(row, row.state).transfer);
}

module.exports = {
  prepare,
  markReviewed,
  execute,
  reconcile: require("./evidence").reconcile,
  list,
  PAYOUT_REASON,
};
