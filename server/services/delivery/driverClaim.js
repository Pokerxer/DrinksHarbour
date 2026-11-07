"use strict";
const mongoose = require("mongoose");
const Driver = require("../../models/Driver"),
  Delivery = require("../../models/Delivery"),
  { ConflictError } = require("../../utils/errors");
async function claimLegacy(tenant, driverId, tripId) {
  const session = await mongoose.startSession();
  let row;
  try {
    await session.withTransaction(async () => {
      const trip = await Delivery.findOneAndUpdate(
        {
          _id: tripId,
          tenant,
          driver: driverId,
          responsibilityVersion: { $ne: 2 },
          status: "assigned",
        },
        { $inc: { __v: 1 } },
        { session, returnDocument: "after" },
      );
      if (!trip)
        throw new ConflictError(
          "Legacy trip changed before rider claim; no goods dispatched",
        );
      row = await Driver.findOneAndUpdate(
        {
          _id: driverId,
          tenant,
          isActive: true,
          managedTrip: null,
          status: { $in: ["available", "on_trip"] },
          $or: [{ legacyTrip: null }, { legacyTrip: tripId }],
        },
        { $set: { legacyTrip: tripId } },
        { session, returnDocument: "after" },
      ).lean();
      if (!row)
        throw new ConflictError(
          "Rider is owned by another trip or unavailable; no goods dispatched",
        );
    });
    return row;
  } finally {
    await session.endSession();
  }
}
// Cancellation/edit and pre-goods dispatch touch the SAME trip and rider in an
// owning transaction. A saved uncertain dispatch claim cannot be detached.
async function editLegacyTrip(tenant, tripId, mutate) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const trip = await Delivery.findOne({
        _id: tripId,
        tenant,
        responsibilityVersion: { $ne: 2 },
      }).session(session);
      if (!trip)
        throw new (require("../../utils/errors").NotFoundError)(
          "Trip not found.",
        );
      if (!["draft", "assigned"].includes(trip.status))
        throw new ConflictError(
          "Only an undispatched trip can be cancelled or edited",
        );
      if (trip.driver) {
        const locked = await Driver.updateOne(
          { _id: trip.driver, tenant, managedTrip: null, legacyTrip: null },
          { $inc: { __v: 1 } },
          { session },
        );
        if (locked.matchedCount !== 1)
          throw new ConflictError(
            "Rider dispatch claim requires exact-trip reconciliation before cancellation or editing",
          );
      }
      await mutate(trip, session);
      trip.increment();
      await trip.save({ session });
      result = trip;
    });
    return result;
  } finally {
    await session.endSession();
  }
}
async function claimManaged(tenant, driverId, tripId, { session }) {
  if (!session?.inTransaction())
    throw new ConflictError("Managed rider claim requires owning transaction");
  const legacy = await Delivery.exists({
    tenant,
    driver: driverId,
    responsibilityVersion: { $ne: 2 },
    status: { $in: ["assigned", "dispatched", "in_progress"] },
  }).session(session);
  if (legacy)
    throw new ConflictError(
      "Rider has an active legacy trip; no managed goods dispatched",
    );
  const row = await Driver.findOneAndUpdate(
    {
      _id: driverId,
      tenant,
      isActive: true,
      status: "available",
      managedTrip: null,
      legacyTrip: null,
    },
    { $set: { status: "on_trip", managedTrip: tripId } },
    { session, returnDocument: "after" },
  ).lean();
  if (!row)
    throw new ConflictError(
      "Rider was claimed by another trip; no goods dispatched",
    );
  return row;
}
async function releaseLegacy(tenant, driverId, tripId) {
  return Driver.updateOne(
    {
      _id: driverId,
      tenant,
      managedTrip: null,
      $or: [{ legacyTrip: tripId }, { legacyTrip: null }],
    },
    { $set: { status: "available", legacyTrip: null } },
  );
}
module.exports = { claimLegacy, claimManaged, releaseLegacy, editLegacyTrip };
