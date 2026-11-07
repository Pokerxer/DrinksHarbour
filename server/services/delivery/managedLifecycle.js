"use strict";
// Child-aware lifecycle branch exported by the existing delivery.service engine.
const mongoose = require("mongoose"),
  Driver = require("../../models/Driver"),
  Child = require("../../models/MerchantOrder"),
  Budget = require("../../models/MerchantDispatchBudget");
const { ConflictError, ValidationError } = require("../../utils/errors"),
  access = require("../merchantFulfillment/access"),
  { bookingDTO } = require("../deliveryProviders/localDispatch/projection"),
  {
    scope,
    coverage,
    hash,
  } = require("../deliveryProviders/localDispatch/quote");
function inputKey(input, keys) {
  if (
    !input ||
    Object.keys(input).some((k) => !keys.includes(k)) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey.trim() ||
    input.idempotencyKey.length > 128
  )
    throw new ValidationError(
      "Expected version and stable lifecycle key required",
    );
}
async function dispatchManagedDelivery(id, input, actor) {
  inputKey(input, ["expectedVersion", "idempotencyKey"]);
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { ownBooking, ownTrip } = require("./managedTrips"),
        row = await ownBooking(id, actor, session),
        trip = await ownTrip(row, session),
        fingerprint = hash(input);
      if (row.dispatchKey) {
        if (
          row.dispatchKey !== input.idempotencyKey ||
          row.dispatchFingerprint !== fingerprint
        )
          throw new ConflictError("Dispatch key or payload differs");
        result = bookingDTO(row);
        return;
      }
      if (
        row.version !== input.expectedVersion ||
        row.state !== "booked" ||
        trip.status !== "assigned" ||
        !trip.driver
      )
        throw new ConflictError(
          "Assigned undispatched responsibility and current version required",
        );
      const loaded = await scope(row.merchantOrder, row.lines, actor, session),
        contract = row.contractSnapshot,
        rule = coverage(
          contract,
          loaded.parent.shippingAddress,
          loaded.snapshot.requirements,
        );
      if (
        hash([loaded.baseHash, contract._id, contract.amountMinor, rule]) !==
        row.scopeHash
      )
        throw new ConflictError(
          "Booked dispatch scope changed; cancel and requote before goods move",
        );
      const driver = await Driver.findOne({
        _id: trip.driver,
        tenant: row.tenant,
        isActive: true,
        status: "available",
        managedTrip: null,
        legacyTrip: null,
      }).session(session);
      if (
        !driver ||
        !contract.vehicleTypes.includes(driver.vehicle?.type) ||
        !Number.isFinite(driver.vehicle?.capacityKg) ||
        driver.vehicle.capacityKg <= 0 ||
        driver.vehicle.capacityKg * 1000 <
          loaded.snapshot.requirements.weightGrams
      )
        throw new ConflictError(
          "Reviewed-capability own driver is unavailable or lacks weight capacity",
        );
      await require("./driverClaim").claimManaged(
        row.tenant,
        driver._id,
        trip._id,
        { session },
      );
      const allocation =
        await require("../merchantFulfillment/quantity/commands").shipQuantities(
          row.merchantOrder,
          {
            lines: row.lines.map(({ line, quantity }) => ({ line, quantity })),
            expectedVersion: row.expectedVersion,
            idempotencyKey: `dispatch:${row._id}`,
          },
          actor,
          { session, dispatchBooking: row._id },
        );
      if (!allocation?._id)
        throw new ConflictError("Canonical goods allocation missing");
      const budget = await Budget.findById(row.merchantOrder).session(session);
      if (!budget || budget.reservedMinor < row.amountMinor)
        throw new ConflictError("Owned dispatch charge reservation missing");
      budget.reservedMinor -= row.amountMinor;
      budget.committedMinor += row.amountMinor;
      await budget.save({ session });
      trip.stops[0].shipmentAllocation = String(allocation._id);
      trip.status = "dispatched";
      trip.dispatchedAt = new Date();
      await trip.save({ session });
      row.shipmentAllocation = String(allocation._id);
      row.state = "dispatched";
      row.version++;
      row.dispatchKey = input.idempotencyKey;
      row.dispatchFingerprint = fingerprint;
      row.dispatchedBy = actor._id;
      row.events.push({
        key: `dispatch:${input.idempotencyKey}`,
        source: "local_dispatch_operator",
        state: "dispatched",
        allocation: String(allocation._id),
        actor: actor._id,
        at: new Date(),
      });
      await row.save({ session });
      await access.audit(row, actor, "LOCAL_DISPATCH_DISPATCHED", { session });
      result = bookingDTO(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
function resolveInput(input) {
  inputKey(input, [
    "expectedVersion",
    "idempotencyKey",
    "status",
    "failureReason",
    "proofOfDelivery",
  ]);
  if (
    !["delivered", "failed"].includes(input.status) ||
    (input.status === "failed" &&
      (typeof input.failureReason !== "string" ||
        input.failureReason.trim().length < 3 ||
        input.failureReason.length > 300))
  )
    throw new ValidationError(
      "Delivered or failed operator observation required",
    );
  if (input.proofOfDelivery) {
    if (
      input.status !== "delivered" ||
      typeof input.proofOfDelivery !== "object" ||
      Array.isArray(input.proofOfDelivery) ||
      Object.keys(input.proofOfDelivery).some(
        (k) => !["recipientName", "note"].includes(k),
      ) ||
      Object.entries(input.proofOfDelivery).some(
        ([k, v]) =>
          typeof v !== "string" ||
          v.length > (k === "recipientName" ? 120 : 500),
      )
    )
      throw new ValidationError("Bounded operator proof fields required");
  }
}
async function resolveManagedDelivery(id, input, actor) {
  resolveInput(input);
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { ownBooking, ownTrip } = require("./managedTrips"),
        row = await ownBooking(id, actor, session),
        trip = await ownTrip(row, session),
        fingerprint = hash(input);
      const prior = row.resolutionOperations.find(
        (op) => op.key === input.idempotencyKey,
      );
      if (
        prior ||
        (row.resolveKey === input.idempotencyKey && !row.activeDelivery)
      ) {
        if ((prior?.fingerprint || row.resolveFingerprint) !== fingerprint)
          throw new ConflictError("Resolution key or payload differs");
        result = bookingDTO(row);
        return;
      }
      if (
        row.resolveKey === input.idempotencyKey ||
        row.resolutionOperations.length >= 10
      )
        throw new ConflictError(
          "Resolution key already used or attempt limit reached",
        );
      if (
        row.version !== input.expectedVersion ||
        row.state !== "dispatched" ||
        !["dispatched", "in_progress"].includes(trip.status) ||
        trip.stops[0].status !== "pending" ||
        !row.shipmentAllocation ||
        trip.stops[0].shipmentAllocation !== row.shipmentAllocation
      )
        throw new ConflictError(
          "Current dispatched responsibility and exact allocation required",
        );
      if (input.status === "delivered") {
        const child = await Child.findOne({
          _id: row.merchantOrder,
          tenant: row.tenant,
        })
          .session(session)
          .lean();
        if (!child) throw new ConflictError("Owned merchant child unavailable");
        await require("../merchantFulfillment/quantity/commands").deliverAllocation(
          row.merchantOrder,
          row.shipmentAllocation,
          {
            expectedVersion: child.version,
            idempotencyKey: `delivered:${row._id}`,
          },
          actor,
          { session, dispatchBooking: row._id },
        );
        trip.stops[0].deliveredAt = new Date();
        if (input.proofOfDelivery)
          trip.stops[0].proofOfDelivery = {
            ...input.proofOfDelivery,
            capturedAt: new Date(),
          };
      } else trip.stops[0].failureReason = input.failureReason.trim();
      trip.stops[0].status = input.status;
      trip.status = "completed";
      trip.completedAt = new Date();
      await trip.save({ session });
      const released = await Driver.updateOne(
        {
          _id: trip.driver,
          tenant: row.tenant,
          managedTrip: trip._id,
          status: "on_trip",
          legacyTrip: null,
        },
        { $set: { status: "available", managedTrip: null, legacyTrip: null } },
        { session },
      );
      if (released.modifiedCount !== 1)
        throw new ConflictError("Owned rider trip requires reconciliation");
      row.state = input.status;
      row.version++;
      row.resolutionOperations.push({
        key: input.idempotencyKey,
        fingerprint,
        delivery: String(trip._id),
      });
      row.resolveKey = input.idempotencyKey;
      row.resolveFingerprint = fingerprint;
      row.resolvedBy = actor._id;
      row.events.push({
        key: `resolve:${input.idempotencyKey}`,
        source: "local_dispatch_operator",
        state: input.status,
        allocation: row.shipmentAllocation,
        actor: actor._id,
        at: new Date(),
        ...(input.status === "failed"
          ? { reason: input.failureReason.trim() }
          : {}),
        ...(input.proofOfDelivery ? { proof: input.proofOfDelivery } : {}),
      });
      await row.save({ session });
      await access.audit(row, actor, "LOCAL_DISPATCH_RESOLVED", { session });
      result = bookingDTO(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = { dispatchManagedDelivery, resolveManagedDelivery };
