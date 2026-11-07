"use strict";
const Booking = require("../../../models/MerchantDispatchBooking"),
  Delivery = require("../../../models/Delivery");
const { ConflictError } = require("../../../utils/errors"),
  { id } = require("../allocation");
function internal(options, session) {
  if (
    !options.session ||
    options.session !== session ||
    !session.inTransaction() ||
    typeof options.dispatchBooking !== "string" ||
    !/^[a-f\d]{64}$/.test(options.dispatchBooking)
  )
    throw new ConflictError(
      "Local dispatch delivery requires the owning rider transaction",
    );
}
async function ship(child, parent, selected, options, session) {
  if (!options.dispatchBooking) return null;
  internal(options, session);
  const row = await Booking.findOne({
    _id: options.dispatchBooking,
    merchantOrder: child._id,
    order: parent._id,
    tenant: child.tenant,
    location: child.location,
    state: "booked",
  })
    .session(session)
    .lean();
  if (!row)
    throw new ConflictError(
      "Saved local dispatch booking authority unavailable",
    );
  const normalized = (lines) =>
    lines
      .map(({ line, quantity }) => ({ line: String(line), quantity }))
      .sort((a, b) => a.line.localeCompare(b.line));
  if (
    row.expectedVersion !== child.version ||
    JSON.stringify(normalized(row.lines)) !==
      JSON.stringify(normalized(selected))
  )
    throw new ConflictError("Exact booked local dispatch quantities required");
  const trip = await Delivery.findOne({
    _id: row.delivery,
    tenant: child.tenant,
    originLocation: child.location,
    responsibilityVersion: 2,
    status: "assigned",
    "stops.dispatchBooking": row._id,
  })
    .session(session)
    .lean();
  if (
    !trip ||
    trip.stops.length !== 1 ||
    trip.stops[0].merchantOrder !== child._id
  )
    throw new ConflictError("Exact local rider responsibility unavailable");
  return row;
}
async function delivery(allocation, child, options, session) {
  const linked = await Booking.findOne({
    ...(allocation.dispatchBooking ? { _id: allocation.dispatchBooking } : {}),
    shipmentAllocation: allocation._id,
    merchantOrder: child._id,
    order: child.order,
    tenant: child.tenant,
    location: child.location,
  })
    .session(session)
    .lean();
  if (!linked && !allocation.dispatchBooking) {
    if (options.dispatchBooking)
      throw new ConflictError("Allocation has no saved local dispatch binding");
    return null;
  }
  if (!options.dispatchBooking)
    throw new ConflictError(
      "Rider-managed delivery must be confirmed through its local dispatch booking",
    );
  internal(options, session);
  if (
    !linked ||
    linked._id !== options.dispatchBooking ||
    linked.state !== "dispatched"
  )
    throw new ConflictError(
      "Saved local dispatch allocation authority unavailable",
    );
  const trip = await Delivery.findOne({
    _id: linked.activeDelivery || linked.delivery,
    tenant: child.tenant,
    originLocation: child.location,
    responsibilityVersion: 2,
    status: { $in: ["dispatched", "in_progress"] },
    "stops.dispatchBooking": linked._id,
  })
    .session(session)
    .lean();
  if (
    !trip ||
    trip.stops.length !== 1 ||
    trip.stops[0].merchantOrder !== child._id ||
    trip.stops[0].shipmentAllocation !== id(allocation._id) ||
    trip.stops[0].status !== "pending"
  )
    throw new ConflictError("Original rider stop allocation is not pending");
  return linked;
}
module.exports = { ship, delivery };
