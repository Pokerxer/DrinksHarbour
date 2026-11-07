"use strict";
const Child = require("../../models/MerchantOrder"),
  Allocation = require("../../models/MerchantShipmentAllocation"),
  { ConflictError } = require("../../utils/errors");
async function goods(row, session, action) {
  const child = await Child.findOne({
      _id: row.merchantOrder,
      order: row.order,
      tenant: row.tenant,
      location: row.location,
      fulfillmentVersion: 2,
    }).session(session),
    allocation = await Allocation.findOne({
      _id: row.shipmentAllocation,
      merchantOrder: row.merchantOrder,
      order: row.order,
      tenant: row.tenant,
      location: row.location,
      state: "shipped",
      dispatchBooking: row._id,
    }).session(session),
    parent =
      child &&
      (await require("../../models/Order")
        .findById(child.order)
        .session(session));
  if (
    !child ||
    !allocation ||
    !parent ||
    allocation.lines.length !== row.lines.length
  )
    throw new ConflictError(
      "Exact original shipped goods authority requires reconciliation",
    );
  for (const line of allocation.lines) {
    const booked = row.lines.find((r) => String(r.line) === line.line);
    if (!booked || booked.quantity !== line.quantity)
      throw new ConflictError("Original booked quantities differ");
    const { hold, progress } =
      await require("../merchantFulfillment/quantity/ownership").owned(
        child,
        parent,
        line.line,
        session,
      );
    const consumed = hold.unitDispositions.filter(
      (r) => r.action === "consume" && r.allocation === allocation._id,
    );
    if (
      consumed.length !== line.ranges.length ||
      line.ranges.some(
        (r) =>
          !consumed.some(
            (c) => c.start === r.start && c.quantity === r.quantity,
          ),
      )
    )
      throw new ConflictError(
        "Original consumed unit ranges require reconciliation",
      );
    if (
      action === "reattempt" &&
      progress.financialBlocks.some((b) =>
        line.ranges.some(
          (r) =>
            r.start < b.start + b.quantity && b.start < r.start + r.quantity,
        ),
      )
    )
      throw new ConflictError(
        "Goods have financial recovery pending; review before another delivery attempt",
      );
  }
  // Shared writes serialize retries/receipts against quantity delivery and financial commands.
  child.increment();
  await child.save({ session });
  allocation.increment();
  await allocation.save({ session });
  return allocation;
}

module.exports = { goods };
