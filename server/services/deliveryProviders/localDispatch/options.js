"use strict";
const Child = require("../../../models/MerchantOrder"),
  Contract = require("../../../models/MerchantLocalDispatchContract"),
  Driver = require("../../../models/Driver"),
  Delivery = require("../../../models/Delivery"),
  Booking = require("../../../models/MerchantDispatchBooking");
const access = require("../../merchantFulfillment/access"),
  { bookingDTO } = require("./projection"),
  { ConflictError } = require("../../../utils/errors");
async function getDispatchOptions(childId, actor) {
  const child = access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor) }).lean(),
    actor,
  );
  if (child.fulfillmentVersion !== 2)
    throw new ConflictError("Quantity version2 dispatch required");
  const [latest, bookings, activeLegacy] = await Promise.all([
    Contract.findOne({ tenant: child.tenant, location: child.location })
      .sort({ version: -1 })
      .lean(),
    Booking.find({ merchantOrder: childId, tenant: child.tenant })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Delivery.find({
      tenant: child.tenant,
      responsibilityVersion: { $ne: 2 },
      driver: { $ne: null },
      status: { $in: ["assigned", "dispatched", "in_progress"] },
    })
      .select("driver")
      .lean(),
  ]);
  const contract =
    latest?.status === "reviewed" && latest.validUntil > new Date()
      ? latest
      : null;
  const available = await Driver.find({
    tenant: child.tenant,
    isActive: true,
    status: "available",
    managedTrip: null,
    legacyTrip: null,
    _id: { $nin: activeLegacy.map((t) => t.driver) },
    "vehicle.capacityKg": { $gt: 0 },
  })
    .sort({ name: 1 })
    .limit(100)
    .select("_id name vehicle.type vehicle.capacityKg")
    .lean();
  const drivers = contract
    ? available.filter((d) => contract.vehicleTypes.includes(d.vehicle?.type))
    : [];
  await access.audit(child, actor, "LOCAL_DISPATCH_OPTIONS_READ");
  return {
    creationEnabled: process.env.MERCHANT_LOCAL_DISPATCH_ENABLED === "true",
    contract: contract
      ? {
          _id: contract._id,
          version: contract.version,
          currency: contract.currency,
          amountMinor: contract.amountMinor,
          maxUnits: contract.maxUnits,
          maxWeightGrams: contract.maxWeightGrams,
          capabilities: contract.capabilities,
          coverage: contract.coverage.map(
            (r) => `${r.city}, ${r.state}, ${r.country}`,
          ),
          validUntil: contract.validUntil,
        }
      : null,
    recoveryDrivers: available.map((d) => ({
      _id: String(d._id),
      name: d.name,
      vehicleType: d.vehicle.type,
      capacityKg: d.vehicle.capacityKg,
    })),
    drivers: drivers.map((d) => ({
      _id: String(d._id),
      name: d.name,
      vehicleType: d.vehicle.type,
      capacityKg: d.vehicle.capacityKg,
    })),
    bookings: bookings.map(bookingDTO),
    hasMoreBookings: bookings.length === 100,
  };
}
module.exports = { getDispatchOptions };
