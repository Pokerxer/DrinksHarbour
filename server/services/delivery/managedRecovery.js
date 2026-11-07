"use strict";
const mongoose = require("mongoose"),
  Delivery = require("../../models/Delivery"),
  Quote = require("../../models/MerchantDispatchQuote");
const { ConflictError, ValidationError } = require("../../utils/errors"),
  access = require("../merchantFulfillment/access"),
  { hash, sid } = require("../deliveryProviders/localDispatch/quote"),
  { bookingDTO } = require("../deliveryProviders/localDispatch/projection");
function validate(input) {
  if (
    !input ||
    Object.keys(input).some(
      (k) =>
        ![
          "action",
          "expectedVersion",
          "idempotencyKey",
          "reason",
          "driverId",
        ].includes(k),
    ) ||
    !["reattempt", "return", "receive_return"].includes(input.action) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey.trim() ||
    input.idempotencyKey.length > 128 ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 300 ||
    (input.action === "reattempt"
      ? !mongoose.isObjectIdOrHexString(input.driverId)
      : input.driverId !== undefined)
  )
    throw new ValidationError(
      "Explicit recovery action, current version, stable key and bounded reason required",
    );
}
async function reattempt(row, trip, input, actor, session) {
  const quote = await Quote.findOne({
    _id: row.quote,
    bookedBy: row._id,
    tenant: row.tenant,
    location: row.location,
    merchantOrder: row.merchantOrder,
    order: row.order,
    scopeHash: row.scopeHash,
  })
    .session(session)
    .lean();
  if (
    !quote ||
    !Number.isFinite(quote.requirements?.weightGrams) ||
    quote.requirements.weightGrams <= 0
  )
    throw new ConflictError(
      "Frozen original transport requirements unavailable",
    );
  const driver = await require("../../models/Driver")
    .findOne({
      _id: input.driverId,
      tenant: row.tenant,
      isActive: true,
      status: "available",
      managedTrip: null,
      legacyTrip: null,
    })
    .session(session)
    .lean();
  if (
    !driver ||
    !row.contractSnapshot.vehicleTypes.includes(driver.vehicle?.type) ||
    !Number.isFinite(driver.vehicle?.capacityKg) ||
    driver.vehicle.capacityKg * 1000 < quote.requirements.weightGrams
  )
    throw new ConflictError(
      "Available own rider matching original handling and capacity required",
    );
  const tripId = new mongoose.Types.ObjectId(
      hash([row._id, "recovery", input.idempotencyKey]).slice(0, 24),
    ),
    original = trip.stops[0].toObject();
  await require("./driverClaim").claimManaged(row.tenant, driver._id, tripId, {
    session,
  });
  await Delivery.create(
    [
      {
        _id: tripId,
        tenant: row.tenant,
        originLocation: row.location,
        responsibilityVersion: 2,
        deliveryNumber: `MR-${String(tripId)}`,
        driver: driver._id,
        status: "dispatched",
        dispatchedAt: new Date(),
        createdBy: actor._id,
        stops: [
          {
            order: row.order,
            merchantOrder: row.merchantOrder,
            dispatchBooking: row._id,
            shipmentAllocation: row.shipmentAllocation,
            sequence: 0,
            addressSnapshot: original.addressSnapshot,
            coordinates: original.coordinates,
            zone: original.zone,
            zoneLabel: original.zoneLabel,
            status: "pending",
            codExpected: 0,
            codCollected: 0,
          },
        ],
      },
    ],
    { session },
  );
  if (
    row.resolveKey &&
    !row.resolutionOperations.some((op) => op.key === row.resolveKey)
  )
    row.resolutionOperations.push({
      key: row.resolveKey,
      fingerprint: row.resolveFingerprint,
      delivery: String(trip._id),
    });
  row.activeDelivery = tripId;
  row.state = "dispatched";
}
async function recoverManagedDelivery(id, input, actor) {
  access.scope(actor, true);
  validate(input);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const { ownBooking, ownTrip } = require("./managedTrips"),
        row = await ownBooking(id, actor, session),
        fingerprint = hash(input),
        prior = row.recoveryOperations.find(
          (r) => r.key === input.idempotencyKey,
        );
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError("Recovery key or payload differs");
        result = bookingDTO(row);
        return;
      }
      if (
        row.version !== input.expectedVersion ||
        row.recoveryOperations.length >= 10 ||
        (input.action === "receive_return"
          ? row.state !== "returning"
          : row.state !== "failed")
      )
        throw new ConflictError(
          "Current failed/returning responsibility and bounded recovery required",
        );
      if (
        input.action === "reattempt" &&
        row.recoveryOperations.filter((r) => r.action === "reattempt").length >=
          8
      )
        throw new ConflictError(
          "Delivery attempt limit reached; review goods return",
        );
      const trip = await ownTrip(row, session);
      if (
        trip.status !== "completed" ||
        trip.stops[0].status !== "failed" ||
        trip.stops[0].shipmentAllocation !== row.shipmentAllocation ||
        trip.stops[0].merchantOrder !== row.merchantOrder ||
        sid(trip.stops[0].order) !== sid(row.order)
      )
        throw new ConflictError(
          "Exact completed failed trip and original allocation required",
        );
      if (
        await require("../../models/Driver")
          .exists({ tenant: row.tenant, managedTrip: trip._id })
          .session(session)
      )
        throw new ConflictError(
          "Failed trip rider claim requires reconciliation",
        );
      if (
        await require("../../models/MerchantDeliveryReturn")
          .exists({ _id: row.shipmentAllocation })
          .session(session)
      )
        throw new ConflictError(
          "Physical return already received; original evidence requires reconciliation",
        );
      const allocation = await require("./managedRecoveryGoods").goods(
        row,
        session,
        input.action,
      );
      if (input.action === "reattempt")
        await reattempt(row, trip, input, actor, session);
      else if (input.action === "return") row.state = "returning";
      else {
        const location = await require("../../models/Warehouse")
          .findOne({
            _id: row.location,
            tenant: row.tenant,
            isActive: { $ne: false },
          })
          .session(session)
          .lean();
        if (!location)
          throw new ConflictError(
            "Original receipt location requires reconciliation",
          );
        await require("../../models/MerchantDeliveryReturn").create(
          [
            {
              _id: row.shipmentAllocation,
              booking: row._id,
              merchantOrder: row.merchantOrder,
              order: row.order,
              tenant: row.tenant,
              location: row.location,
              shipmentAllocation: row.shipmentAllocation,
              lines: allocation.lines.map((l) => ({
                line: l.line,
                quantity: l.quantity,
                ranges: l.ranges.map((r) => ({
                  start: r.start,
                  quantity: r.quantity,
                })),
              })),
              disposition: "quarantined",
              receivedBy: actor._id,
              receivedAt: new Date(),
              reason: input.reason.trim(),
            },
          ],
          { session },
        );
        row.state = "returned";
      }
      row.version++;
      row.recoveryOperations.push({
        key: input.idempotencyKey,
        fingerprint,
        action: input.action,
        delivery: row.activeDelivery || row.delivery,
      });
      row.events.push({
        key: `recovery:${input.idempotencyKey}`,
        source: "local_dispatch_operator",
        state: row.state,
        allocation: row.shipmentAllocation,
        actor: actor._id,
        at: new Date(),
        reason: input.reason.trim(),
      });
      await row.save({ session });
      await access.audit(
        row,
        actor,
        `LOCAL_DISPATCH_${input.action.toUpperCase()}`,
        { session },
      );
      result = bookingDTO(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = { recoverManagedDelivery };
