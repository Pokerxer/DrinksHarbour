"use strict";
// Shared command scaffolding for the statement-linked payout mechanism
// (workstream P): fail-closed gates, the idempotency anchor key, the result
// projection, and the statement-linked transferable-base resolver. All money
// authority derives from the READ-ONLY settlement statement projection
// (settlement/statement.js, read-import UNMODIFIED) plus the recorded payout
// policy — nothing is invented here.
const { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors");
const Transfer = require("../../../models/MerchantPayoutTransfer");
const balance = require("./balance");
const statementLink = require("./statementLink");
const policyAuthority = require("./policy");
const Child = require("../../../models/MerchantOrder");

const PAYOUT_REASON = "No payout execution exists; payout policy requires review.";
const FLAG = "MERCHANT_PAYOUT_TRANSFERS_ENABLED";

const key = (childId, idempotencyKey) =>
  require("node:crypto")
    .createHash("sha256")
    .update(`merchant-payout-transfer:${childId}:${idempotencyKey}`)
    .digest("hex");

function present(row, status) {
  return { status, transfer: row.toObject ? row.toObject() : { ...row } };
}

function assertOperator(actor) {
  require("../refundAuthority").platform(actor);
}

// Flag off or an unrecorded contract both refuse with the verbatim recorded
// payout posture from the settlement statement, before any write.
function assertFlag() {
  if (process.env[FLAG] !== "true")
    throw new ConflictError(PAYOUT_REASON);
}

async function assertPolicy() {
  const policy = await policyAuthority.active();
  if (!policy) throw new ConflictError(PAYOUT_REASON);
  return policy;
}

function assertCommand(command) {
  if (typeof command?.childId !== "string" || command.childId.length < 1)
    throw new NotFoundError("Merchant order not found");
  if (
    typeof command?.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 128
  )
    throw new ValidationError("Idempotency-Key is required for a payout transfer command");
  if (!Number.isSafeInteger(command?.amountMinor) || command.amountMinor < 1)
    throw new ValidationError("Payout amount must be a positive integer minor amount");
  if (
    typeof command?.destinationAccountReference !== "string" ||
    command.destinationAccountReference.trim().length < 1 ||
    command.destinationAccountReference.trim().length > 200
  )
    throw new ValidationError(
      "Payout destination account reference is required (a recorded tenant payout account reference id; no account numbers or rails)",
    );
}

async function resolveTransfer(childId, actor, policy) {
  const base = await statementLink.transferableBase(childId, actor, policy);
  const { transferredMinor } = await balance.consumed(childId);
  return { base, available: base.transferableBaseMinor - transferredMinor };
}

// The exact statement source figures a transfer record pins so a future
// payout statement reconciles without a second ledger.
function figures(row, base) {
  return {
    netSettledMinor: base.netReceivable.settledMinor,
    netReservedMinor: base.netReceivable.reservedMinor,
    netProjectedMinor: base.netMinor,
    tenantShareMinor: row.totals.tenantShareMinor,
    settledRefundMinor: row.refunds.settledMinor,
    settledCommissionMinor: row.refunds.settledCommissionMinor,
    goodsOriginalCostMinor: row.goodsCost.originalCostMinor,
    goodsCancelledCostMinor: row.goodsCost.cancelledCostMinor,
    carrierCommittedMinor: row.carrierCost.committedMinor,
  };
}

async function childOrNotFound(childId) {
  const child = await Child.findOne({ _id: childId }).lean();
  if (!child) throw new NotFoundError("Merchant order not found");
  return child;
}

module.exports = {
  PAYOUT_REASON,
  FLAG,
  key,
  present,
  assertOperator,
  assertFlag,
  assertPolicy,
  assertCommand,
  resolveTransfer,
  figures,
  childOrNotFound,
};
