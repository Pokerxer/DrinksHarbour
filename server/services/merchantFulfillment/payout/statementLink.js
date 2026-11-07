"use strict";
// Statement-link module (workstream P). READ-ONLY import of the approved
// settlement statement projection (settlement/statement.js, UNMODIFIED):
// the transferable payout base is derived from the statement's net
// receivable minus recorded holds — conserved EXACTLY against the linked
// statement version. Every refusal is explicit and carries the statement's
// own recorded reason; the module never mutates anything.
const statement = require("../settlement/statement");
const Hold = require("../../../models/MerchantPayoutHold");
const { ConflictError } = require("../../../utils/errors");

const NOT_RECONCILED_PREFIX = "Settlement statement is not reconciled";

function firstReason(statement) {
  const items = statement.reconciliation.items || [];
  const uncertain = statement.reconciliation.uncertain || [];
  const reason =
    items[0]?.reason ||
    (uncertain[0]
      ? "Refund outcome requires reconciliation; do not resubmit. Reserved budget stays held."
      : null);
  return reason || "Settlement statement figures require reconciliation.";
}

// The statement MUST be reconciled before any payout command can read a
// transferable base: needs_review or uncertain items consumed by the
// statement refuse the command with their own recorded reason.
function assertReconciled(row) {
  if (row.reconciliation?.state !== "reconciled") {
    const items = (row.reconciliation?.items || []).length;
    const uncertain = (row.reconciliation?.uncertain || []).length;
    throw new ConflictError(
      `${NOT_RECONCILED_PREFIX} (${items} reconciliation item(s), ${uncertain} uncertain outcome(s)): ${firstReason(row)}`,
    );
  }
  return row;
}

function readStatement(childId, actor) {
  if (typeof childId !== "string" || !/^[0-9a-fA-F]{24,128}$/.test(childId))
    throw new ConflictError("Merchant order not found");
  return statement.child(childId, actor);
}

// Transferable base for the recorded payout policy:
//   base = statement netReceivable.projected (settled − reserved)
//          − recorded holds total − recorded standing hold
// Refuses (explicit reasons) while the statement is not reconciled or while
// the net receivable does not exceed the recorded minimum threshold.
async function transferableBase(childId, actor, policy) {
  const row = await readStatement(childId, actor);
  assertReconciled(row);
  const net = row.netReceivable.projectedMinor;
  if (
    !Number.isSafeInteger(net) ||
    net < 0 ||
    !Number.isSafeInteger(row.netReceivable.settledMinor) ||
    !Number.isSafeInteger(row.netReceivable.reservedMinor)
  )
    throw new ConflictError(
      "Settlement statement net receivable figures require reconciliation.",
    );
  if (net <= policy.minimumThresholdMinor)
    throw new ConflictError(
      `Net receivable does not exceed the recorded payout minimum threshold (${policy.minimumThresholdMinor} minor per recorded payout policy v${policy.version}).`,
    );
  const standingHoldMinor = policy.standingHoldMinor ?? 0;
  const holds = await Hold.find({ child: String(childId) }).lean();
  const heldTotalMinor =
    holds.reduce((n, hold) => n + (hold.amountMinor || 0), 0) + standingHoldMinor;
  const transferableBaseMinor = net - heldTotalMinor;
  // The balance guard's net figure excludes the policy's standing hold so
  // the joint conservation predicate stays single-sourced:
  //   netMinor − heldMinor − transferredMinor = transferable remainder
  const standingNetMinor = net - standingHoldMinor;
  if (!Number.isSafeInteger(heldTotalMinor) || transferableBaseMinor < 0)
    throw new ConflictError(
      "Recorded payout holds cannot exceed the statement net receivable; holds require reconciliation.",
    );
  return {
    statement: row,
    currency: row.currency,
    netMinor: net,
    standingNetMinor,
    netReceivable: {
      settledMinor: row.netReceivable.settledMinor,
      reservedMinor: row.netReceivable.reservedMinor,
    },
    heldTotalMinor,
    standingHoldMinor,
    recordedHoldMinor: heldTotalMinor - standingHoldMinor,
    transferableBaseMinor,
  };
}

module.exports = { readStatement, assertReconciled, transferableBase, NOT_RECONCILED_PREFIX };
