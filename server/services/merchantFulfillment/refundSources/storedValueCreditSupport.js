"use strict";
// Support primitives for the stored-value refund credit command (workstream W):
// result projection and the per-debit remainder guard. The append-only balance
// ledgers remain PlatformWalletTransaction / GiftCardTransaction; neither this
// module nor StoredValueRefundCredit/StoredValueRefundRemainder is a second
// ledger — they are the once-only command record (Phase A CheckoutDebit
// primitive) and the multi-refund remainder guard required by the package spec.
const { ConflictError } = require("../../../utils/errors");
const Remainder = require("../../../models/StoredValueRefundRemainder");

const naira = (amountMinor) => amountMinor / 100;

// Rebuild the command result from the StoredValueRefundCredit record alone —
// used for both the fresh outcome and the idempotent replay (identical shape).
function present(record, status) {
  return {
    status,
    kind: record.kind,
    destination: { type: record.destinationType, id: record.destinationId },
    amountMinor: record.amountMinor,
    currency: record.currency,
    originalDebit: {
      id: record.debitTransaction,
      amount: naira(record.originalMinor),
      amountMinor: record.originalMinor,
      createdAt: record.debitCreatedAt,
      funding: {
        status: record.fundingStatus ?? null,
        reason: record.fundingReason ?? null,
      },
    },
    remainderMinor: record.remainderMinorAfter,
    ledger: {
      model: record.ledgerModel,
      id: record.ledgerId,
      type: "refund",
      balanceAfter: record.balanceAfter,
    },
    reconciliation: {
      state: record.reconciledTenant ? "recorded" : "not_applicable",
      tenant: record.reconciledTenant ?? null,
      reason: record.reconciledTenant
        ? "Credit reconciles against the platform-to-tenant settlement recorded on the original checkout debit."
        : "The original checkout debit was not redeemed at a tenant; no settlement reconciliation applies.",
    },
    policy: { id: record.policyId, version: record.policyVersion },
  };
}

// Exact remainder advance: conditional update (conservation evaluated
// server-side), then insert when absent, then a conditional retry if a
// concurrent creator won the insert. Concurrent commands with different
// idempotency keys can never over-credit the original debit.
async function advanceRemainder(debitTxId, originalMinor, amountMinor, session) {
  const filter = {
    _id: debitTxId,
    creditedMinor: { $lte: originalMinor - amountMinor },
  };
  const update = { $inc: { creditedMinor: amountMinor } };
  let row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
  if (row) return row;
  if (await Remainder.exists({ _id: debitTxId }).session(session))
    throw new ConflictError(
      "Stored-value refund credit exceeds the remaining refundable balance of the original checkout debit.",
    );
  try {
    return await Remainder.create(
      [{ _id: debitTxId, originalMinor, creditedMinor: amountMinor }],
      { session },
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
    if (!row)
      throw new ConflictError(
        "Stored-value refund credit exceeds the remaining refundable balance of the original checkout debit.",
      );
    return row;
  }
}

module.exports = { present, advanceRemainder, naira };
