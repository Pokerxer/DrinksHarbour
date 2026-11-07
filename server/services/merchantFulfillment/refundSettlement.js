"use strict";
const mongoose = require("mongoose");
const Refund = require("../../models/MerchantRefundAllocation");
const Child = require("../../models/MerchantOrder");
const Group = require("../../models/MerchantOrderSet");
const { ConflictError, NotFoundError } = require("../../utils/errors");
const { id } = require("./allocation");
const access = require("./access");
const authority = require("./refundAuthority");
const dto = require("./refundView");
async function settle(refundId, result, actor) {
  const session = await mongoose.startSession();
  let output;
  try {
    await session.withTransaction(async () => {
      const row = await Refund.findById(refundId).session(session);
      if (!row) throw new NotFoundError("Refund allocation not found");
      authority.evidence(row, result);
      if (row.state === "succeeded") {
        output = dto(row);
        return;
      }
      if (
        !require("./refundProviders").succeeded(row, result) ||
        !["submitting", "uncertain"].includes(row.state)
      )
        throw new ConflictError("Provider refund requires reconciliation");
      const child = await Child.findOne({
          _id: row.merchantOrder,
          tenant: row.tenant,
        }).session(session),
        group = await Group.findById(row.order).session(session);
      if (!child || !group || !group.children.includes(row.merchantOrder))
        throw new ConflictError("Refund allocation ownership unavailable");
      const original = await authority.original(child, session),
        { parent, receipt } = original;
      authority.reserved(row, original);
      if (
        receipt._id !== row.receipt ||
        receipt.reference !== row.providerReference ||
        id(parent.user) !== id(row.customer) ||
        child.refundReservedMinor < row.amountMinor ||
        group.refundReservedMinor < row.amountMinor ||
        group.refundedMinor + row.amountMinor > group.totalMinor
      )
        throw new ConflictError("Original refund budget or receipt changed");
      const Evidence = require("../../models/MerchantRefundEvidence"),
        evidenceId = `${row.provider}:${row.account}:${result.id}`;
      const used = await Evidence.findById(evidenceId).session(session).lean();
      if (used && id(used.allocation) !== id(row._id))
        throw new ConflictError(
          "Provider refund evidence already used by another allocation",
        );
      if (!used)
        await Evidence.create(
          [
            {
              _id: evidenceId,
              allocation: row._id,
              order: row.order,
              amountMinor: row.amountMinor,
              currency: row.currency,
            },
          ],
          { session },
        );
      const lines = [
        { account: "4000", debit: row.amountMinor / 100, credit: 0 },
      ];
      if (row.tenantShareMinor)
        lines.push({
          account: "1300",
          debit: 0,
          credit: row.tenantShareMinor / 100,
        });
      if (row.commissionMinor)
        lines.push({
          account: "6500",
          debit: 0,
          credit: row.commissionMinor / 100,
        });
      await require("../journalEntry.service").postJournalEntry({
        tenantId: row.tenant,
        refDoc: row._id,
        refDocType: "MerchantRefundAllocation",
        entryType: "refund",
        source: "merchant_refund",
        date: new Date(),
        lines,
        postedBy: actor._id,
        memo: "Verified original-receipt merchandise refund; goods unchanged",
        session,
      });
      child.refundReservedMinor -= row.amountMinor;
      child.refundedMinor += row.amountMinor;
      child.refundedCommissionMinor += row.commissionMinor;
      if (row.fulfillmentVersion === 2)
        require("./quantity/refunds").settleBlocks(row, child);
      await child.save({ session });
      group.refundReservedMinor -= row.amountMinor;
      group.refundedMinor += row.amountMinor;
      group.version++;
      await group.save({ session });
      await require("../../models/Order").updateOne(
        {
          _id: row.order,
          merchantFulfillmentVersion: parent.merchantFulfillmentVersion,
        },
        {
          $set: {
            paymentStatus:
              group.refundedMinor === group.totalMinor
                ? "refunded"
                : "partially_refunded",
          },
        },
        { session },
      );
      await access.audit(row, actor, "MERCHANT_REFUND_SETTLE", { session });
      row.state = "succeeded";
      row.providerRefundId = String(result.id);
      row.processedAt = new Date();
      row.executedBy = actor._id;
      row.issue = "";
      await row.save({ session });
      output = dto(row);
    });
    return output;
  } finally {
    await session.endSession();
  }
}
module.exports = settle;
