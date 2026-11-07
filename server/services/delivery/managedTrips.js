"use strict";
// Additive branch of the existing Delivery/Driver engine; goods commands stay canonical.
const mongoose = require("mongoose"),
  Delivery = require("../../models/Delivery"),
  Driver = require("../../models/Driver"),
  Booking = require("../../models/MerchantDispatchBooking"),
  Budget = require("../../models/MerchantDispatchBudget");
const access = require("../merchantFulfillment/access"),
  { ConflictError, NotFoundError } = require("../../utils/errors"),
  { bookingDTO } = require("../deliveryProviders/localDispatch/projection");
function transaction(session) {
  if (!session?.inTransaction())
    throw new ConflictError("Managed trip requires owning transaction");
}
async function createManagedDelivery(
  booking,
  parent,
  driverId,
  actor,
  { session },
) {
  transaction(session);
  access.assertOwned(booking, actor, true);
  if (driverId) {
    const driver = await Driver.findOne({
      _id: driverId,
      tenant: booking.tenant,
      isActive: true,
      status: "available",
      managedTrip: null,
      legacyTrip: null,
    })
      .session(session)
      .lean();
    if (
      !driver ||
      !booking.contractSnapshot.vehicleTypes.includes(driver.vehicle?.type)
    )
      throw new ConflictError(
        "Available own reviewed-capability driver required",
      );
  }
  const address = parent.shippingAddress || {};
  const [trip] = await Delivery.create(
    [
      {
        _id: booking.delivery,
        tenant: booking.tenant,
        responsibilityVersion: 2,
        originLocation: booking.location,
        deliveryNumber: `MD-${booking._id.slice(0, 20)}`,
        driver: driverId || null,
        status: driverId ? "assigned" : "draft",
        createdBy: actor._id,
        stops: [
          {
            order: booking.order,
            merchantOrder: booking.merchantOrder,
            dispatchBooking: booking._id,
            sequence: 0,
            addressSnapshot: {
              fullName: address.fullName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              state: address.state,
            },
            coordinates: {
              lat: address.coordinates.latitude,
              lng: address.coordinates.longitude,
            },
            status: "pending",
            codExpected: 0,
            codCollected: 0,
          },
        ],
      },
    ],
    { session },
  );
  return trip;
}
async function ownBooking(id, actor, session) {
  return access.assertOwned(
    await Booking.findOne({ _id: id, ...access.scope(actor, true) }).session(
      session,
    ),
    actor,
    true,
  );
}
async function ownTrip(row, session) {
  const trip = await Delivery.findOne({
    _id: row.activeDelivery || row.delivery,
    tenant: row.tenant,
    originLocation: row.location,
    responsibilityVersion: 2,
    "stops.dispatchBooking": row._id,
  }).session(session);
  if (!trip || trip.stops.length !== 1)
    throw new NotFoundError("Owned managed trip not found");
  return trip;
}
async function cancelManagedDelivery(id, input, actor) {
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const row = await ownBooking(id, actor, session),
        trip = await ownTrip(row, session);
      if (row.state === "cancelled") {
        if (
          row.cancelKey !== input.idempotencyKey ||
          row.cancelReason !== input.reason.trim()
        )
          throw new ConflictError("Dispatch cancel key or payload differs");
        result = bookingDTO(row);
        return;
      }
      if (
        row.state !== "booked" ||
        !["draft", "assigned"].includes(trip.status)
      )
        throw new ConflictError(
          "Only undispatched service responsibility can be cancelled",
        );
      const budget = await Budget.findById(row.merchantOrder).session(session);
      if (!budget || budget.reservedMinor < row.amountMinor)
        throw new ConflictError(
          "Owned dispatch charge reservation unavailable",
        );
      budget.reservedMinor -= row.amountMinor;
      await budget.save({ session });
      trip.status = "cancelled";
      trip.cancelledReason = input.reason.trim();
      await trip.save({ session });
      row.state = "cancelled";
      row.version++;
      row.cancelKey = input.idempotencyKey;
      row.cancelReason = input.reason.trim();
      row.cancelledBy = actor._id;
      row.events.push({
        key: `cancel:${input.idempotencyKey}`,
        source: "local_dispatch_operator",
        state: "cancelled",
        actor: actor._id,
        at: new Date(),
      });
      await row.save({ session });
      await access.audit(row, actor, "LOCAL_DISPATCH_CANCELLED", { session });
      result = bookingDTO(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = {
  ...require("./managedLifecycle"),
  createManagedDelivery,
  cancelManagedDelivery,
  ownBooking,
  ownTrip,
  transaction,
};
