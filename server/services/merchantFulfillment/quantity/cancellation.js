"use strict";
const mongoose = require("mongoose"),
  Cancellation = require("../../../models/MerchantQuantityCancellation"),
  { ConflictError } = require("../../../utils/errors"),
  { hash } = require("../allocation"),
  { run } = require("./transaction"),
  ownership = require("./ownership"),
  ranges = require("./ranges");
function refundable(total, blocks, used, quantity) {
  const eligible = ranges.checked(
      total,
      blocks.filter((row) => row.kind === "refunded"),
    ),
    available = eligible.reduce((n, row) => n + row.quantity, 0);
  const blocked =
    available === total
      ? []
      : ranges.select(total, [], eligible, total - available);
  return ranges.select(total, used, blocked, quantity);
}
async function cancelQuantities(childId, input, actor, options = {}) {
  const selected = ownership.lines(input);
  return run(
    childId,
    { ...input, lines: selected },
    actor,
    "cancel",
    async ({ child, parent, session }) => {
      if (child.shippingMinor || child.taxMinor)
        throw new ConflictError(
          "Quantity cancellation requires reviewed shipping and tax refund allocation",
        );
      if (
        !["pending", "accepted", "picking", "partially_shipped"].includes(
          child.state,
        )
      )
        throw new ConflictError(
          "Only remaining unshipped units can be cancelled",
        );
      const allocationId = new mongoose.Types.ObjectId(
          hash(childId + ":cancel:" + input.idempotencyKey).slice(0, 24),
        ),
        planned = [];
      for (const request of selected) {
        const owned = await ownership.owned(
            child,
            parent,
            request.line,
            session,
          ),
          unitRanges = refundable(
            owned.snapshot.quantity,
            owned.progress.financialBlocks || [],
            owned.used,
            request.quantity,
          );
        planned.push({
          ...owned,
          line: request.line,
          quantity: request.quantity,
          ranges: unitRanges,
          batches: ranges.batchSlice(
            owned.hold.batchAllocations,
            unitRanges,
            owned.hold.quantity,
          ),
        });
      }
      await require("./goodsCancellation").cancelQuantityGoodsAccounting({
        parent,
        child,
        lines: planned.map((row) => ({ line: row.line, ranges: row.ranges })),
        allocationId,
        actor,
        session,
      });
      for (const row of planned) {
        await require("../../storefrontOwnedStock").applyOwnedStock({
          hold: row.hold,
          quantity: row.quantity,
          action: "release",
          batches: row.batches,
          reference: `online-release:${allocationId}`,
          orderId: parent._id,
          actorId: actor._id,
          session,
        });
        for (const unit of row.ranges)
          row.hold.unitDispositions.push({
            ...unit,
            action: "release",
            allocation: String(allocationId),
          });
        row.hold.releasedQuantity += row.quantity;
        if (
          row.hold.consumedQuantity + row.hold.releasedQuantity ===
          row.hold.quantity
        )
          row.hold.state = row.hold.consumedQuantity ? "consumed" : "released";
        await row.hold.save({ session });
        row.progress.cancelled += row.quantity;
      }
      const [row] = await Cancellation.create(
        [
          {
            _id: allocationId,
            merchantOrder: child._id,
            order: parent._id,
            tenant: child.tenant,
            location: child.location,
            releasedBy: actor._id,
            lines: planned.map((value) => ({
              line: value.line,
              quantity: value.quantity,
              ranges: value.ranges,
              batchAllocations: value.batches,
            })),
          },
        ],
        { session },
      );
      return row.toObject();
    },
    options,
  );
}
module.exports = { cancelQuantities };
