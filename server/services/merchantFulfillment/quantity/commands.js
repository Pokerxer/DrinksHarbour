"use strict";
const Allocation = require("../../../models/MerchantShipmentAllocation"),
  {
    ConflictError,
    NotFoundError,
    ValidationError,
  } = require("../../../utils/errors"),
  { hash, id } = require("../allocation"),
  { run } = require("./transaction"),
  ownership = require("./ownership"),
  ranges = require("./ranges");
async function shipQuantities(childId, input, actor, options = {}) {
  const selected = ownership.lines(input),
    payload = {
      ...input,
      lines: selected,
      ...(options.dispatchBooking
        ? { dispatchBooking: options.dispatchBooking }
        : {}),
    };
  return run(
    childId,
    payload,
    actor,
    "ship",
    async ({ child, parent, operationId, session }) => {
      if (!["accepted", "picking", "partially_shipped"].includes(child.state))
        throw new ConflictError("Accept merchant quantities before shipment");
      if (!["paid", "partially_refunded"].includes(parent.paymentStatus))
        throw new ConflictError(
          "Original verified payment required for shipment",
        );
      const dispatch = await require("./deliveryBinding").ship(
        child,
        parent,
        selected,
        options,
        session,
      );
      const allocationId = hash(childId + ":shipment:" + input.idempotencyKey),
        result = [];
      for (const request of selected) {
        const { snapshot, progress, actual, hold, used } =
          await ownership.owned(child, parent, request.line, session);
        const movementReference = `online-unit:${hash(hold._id + ":" + allocationId)}`;
        const unitRanges = ranges.select(
            snapshot.quantity,
            used,
            progress.financialBlocks || [],
            request.quantity,
          ),
          batches = ranges.batchSlice(
            hold.batchAllocations,
            unitRanges,
            hold.quantity,
          );
        await require("../../storefrontOwnedStock").applyOwnedStock({
          hold,
          quantity: request.quantity,
          action: "consume",
          batches,
          reference: movementReference,
          orderId: parent._id,
          actorId: actor._id,
          session,
        });
        for (const unit of unitRanges)
          hold.unitDispositions.push({
            ...unit,
            action: "consume",
            allocation: allocationId,
          });
        hold.consumedQuantity += request.quantity;
        if (hold.consumedQuantity + hold.releasedQuantity === hold.quantity)
          hold.state = "consumed";
        await hold.save({ session });
        progress.shipped += request.quantity;
        actual.batchAllocations.push(...batches);
        result.push({
          line: request.line,
          quantity: request.quantity,
          ranges: unitRanges,
          batchAllocations: batches,
          movementReference,
        });
      }
      parent.$locals.deferAccounting = true;
      await parent.save({ session });
      const [row] = await Allocation.create(
        [
          {
            _id: allocationId,
            merchantOrder: child._id,
            order: parent._id,
            tenant: child.tenant,
            location: child.location,
            currency: child.currency,
            lines: result,
            shippedBy: actor._id,
            ...(dispatch ? { dispatchBooking: dispatch._id } : {}),
          },
        ],
        { session },
      );
      return row.toObject();
    },
    options,
  );
}
async function deliverAllocation(
  childId,
  allocationId,
  input,
  actor,
  options = {},
) {
  if (
    Object.keys(input || {}).some(
      (key) => !["expectedVersion", "idempotencyKey"].includes(key),
    ) ||
    typeof allocationId !== "string" ||
    !/^[a-f\d]{64}$/.test(allocationId)
  )
    throw new ValidationError("Valid original shipment allocation required");
  return run(
    childId,
    {
      ...input,
      allocationId,
      ...(options.dispatchBooking
        ? { dispatchBooking: options.dispatchBooking }
        : {}),
    },
    actor,
    "deliver",
    async ({ child, session }) => {
      const row = await Allocation.findOne({
        _id: allocationId,
        merchantOrder: childId,
        tenant: child.tenant,
        location: child.location,
      }).session(session);
      if (!row) throw new NotFoundError("Shipment allocation not found");
      const dispatch = await require("./deliveryBinding").delivery(
        row,
        child,
        options,
        session,
      );
      if (row.state === "delivered" && dispatch) return row.toObject();
      if (row.state === "delivered")
        throw new ConflictError(
          "Shipment already delivered; recover original operation key",
        );
      for (const line of row.lines) {
        const progress = child.quantityProgress.find(
          (value) => value.line === line.line,
        );
        if (!progress || progress.delivered + line.quantity > progress.shipped)
          throw new ConflictError(
            "Delivered quantity exceeds original shipment",
          );
        progress.delivered += line.quantity;
      }
      row.state = "delivered";
      row.version++;
      row.deliveredBy = actor._id;
      row.deliveredAt = new Date();
      await row.save({ session });
      return row.toObject();
    },
    options,
  );
}
module.exports = {
  shipQuantities,
  deliverAllocation,
  cancelQuantities: require("./cancellation").cancelQuantities,
};
