"use strict";
const Child = require("../../../models/MerchantOrder"),
  Allocation = require("../../../models/MerchantShipmentAllocation"),
  access = require("../access"),
  { ConflictError, ValidationError } = require("../../../utils/errors");
function dto(row, deliveryManaged = false) {
  const raw = row.toObject ? row.toObject() : row;
  return {
    _id: raw._id,
    merchantOrder: raw.merchantOrder,
    state: raw.state,
    version: raw.version,
    createdAt: raw.createdAt,
    deliveredAt: raw.deliveredAt,
    ...(raw.dispatchBooking || deliveryManaged === true
      ? { deliveryManaged: true }
      : {}),
    lines: raw.lines.map((line) => ({
      line: line.line,
      quantity: line.quantity,
      ranges: line.ranges.map((range) => ({
        start: range.start,
        quantity: range.quantity,
      })),
    })),
  };
}
async function list(childId, actor, query = {}) {
  if (
    Object.keys(query).some((key) => key !== "cursor") ||
    (query.cursor !== undefined && !/^[a-f\d]{64}$/.test(query.cursor))
  )
    throw new ValidationError("Invalid quantity allocation cursor");
  const child = access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor) }).lean(),
    actor,
  );
  if (child.fulfillmentVersion !== 2)
    throw new ConflictError("Quantity allocations require version2");
  await access.audit(child, actor, "MERCHANT_QUANTITY_ALLOCATIONS_READ");
  const rows = await Allocation.find({
      merchantOrder: childId,
      order: child.order,
      tenant: child.tenant,
      location: child.location,
      ...(query.cursor ? { _id: { $gt: query.cursor } } : {}),
    })
      .sort({ _id: 1 })
      .limit(26)
      .lean(),
    hasMore = rows.length > 25,
    visible = rows.slice(0, 25);
  const bookings = await require("../../../models/MerchantDispatchBooking")
    .find({
      merchantOrder: childId,
      order: child.order,
      tenant: child.tenant,
      location: child.location,
      shipmentAllocation: { $in: visible.map((row) => row._id) },
    })
    .select("shipmentAllocation")
    .lean();
  const managed = new Set(bookings.map((row) => row.shipmentAllocation));
  return {
    allocations: visible.map((row) => dto(row, managed.has(row._id))),
    pagination: { hasMore, nextCursor: hasMore ? visible.at(-1)._id : null },
  };
}
module.exports = { list, dto };
