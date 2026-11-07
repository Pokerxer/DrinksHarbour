"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "explicit saved rider links recover an earlier delivered allocation without inferring or replaying goods",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "merchant_dispatch_binding");
    const flags = [
        "MERCHANT_FULFILLMENT_ENABLED",
        "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
        "MERCHANT_LOCAL_DISPATCH_ENABLED",
      ],
      previous = flags.map((k) => process.env[k]);
    flags.forEach((k) => (process.env[k] = "true"));
    t.after(() =>
      flags.forEach((k, i) =>
        previous[i] === undefined
          ? delete process.env[k]
          : (process.env[k] = previous[i]),
      ),
    );
    const f = await require("./helpers/merchantQuantityFixture").fixture(),
      Child = require("../models/MerchantOrder"),
      Allocation = require("../models/MerchantShipmentAllocation"),
      Order = require("../models/Order"),
      Driver = require("../models/Driver"),
      service = require("../services/deliveryProviders/localDispatch"),
      engine = require("../services/delivery.service");
    const child = await Child.findOne({
        order: f.order._id,
        tenant: f.actors[0].tenant,
      }).lean(),
      actor = f.actors[0],
      line = child.lines[0];
    await Order.collection.updateOne(
      { _id: f.order._id },
      {
        $set: {
          shippingMethod: "standard",
          "shippingAddress.coordinates": { latitude: 9.05, longitude: 7.4 },
        },
      },
    );
    await require("../models/Product").collection.updateOne(
      { _id: line.product },
      { $set: { type: "soft_drink", isAlcoholic: false } },
    );
    await require("../models/SubProduct").collection.updateOne(
      { _id: line.subproduct },
      {
        $set: {
          shipping: {
            fragile: false,
            hazmat: false,
            requiresAgeVerification: false,
          },
        },
      },
    );
    await require("../models/Size").collection.updateOne(
      { _id: line.size },
      {
        $set: {
          shippingWeight: 1000,
          packaging: { type: "plastic_bottle", material: "plastic" },
        },
      },
    );
    await require("../services/merchantFulfillment/actions").act(
      child._id,
      {
        action: "accept",
        expectedVersion: 1,
        idempotencyKey: "binding-accept",
      },
      actor,
    );
    await service.reviewContract(
      {
        tenant: String(child.tenant),
        location: String(child.location),
        version: 1,
        currency: "NGN",
        amountMinor: 0,
        maxUnits: 5,
        maxWeightGrams: 5000,
        vehicleTypes: ["bike"],
        coverage: [
          {
            country: "Nigeria",
            state: "FCT",
            city: "Abuja",
            minLat: 9,
            maxLat: 9.1,
            minLon: 7.3,
            maxLon: 7.5,
          },
        ],
        capabilities: {
          alcohol: false,
          ageVerification: false,
          fragile: false,
        },
        reviewReference: "synthetic-recovery-only",
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      },
      f.admin,
    );
    const driver = await Driver.create({
      tenant: child.tenant,
      name: "Synthetic recovery rider",
      phone: "binding-recovery",
      vehicle: { type: "bike", capacityKg: 10 },
    });
    const quote = await service.quoteDispatch(
        child._id,
        { lines: [{ line: String(line.line), quantity: 1 }] },
        actor,
      ),
      booking = await service.bookDispatch(
        child._id,
        {
          quoteId: String(quote._id),
          driverId: String(driver._id),
          idempotencyKey: "binding-trip",
        },
        actor,
      );
    const shipped = await engine.dispatchManagedDelivery(
      booking._id,
      { expectedVersion: 1, idempotencyKey: "binding-dispatch" },
      actor,
    );
    assert.equal(
      (await Allocation.findById(shipped.shipmentAllocation)).dispatchBooking,
      booking._id,
    );
    // Old accepted rows have no new field: the existing exact booking+stop link remains authority.
    await Allocation.collection.updateOne(
      { _id: shipped.shipmentAllocation },
      {
        $unset: { dispatchBooking: "" },
        $set: { state: "delivered", deliveredAt: new Date() },
        $inc: { version: 1 },
      },
    );
    const saved = await Child.findById(child._id).lean(),
      index = saved.quantityProgress.findIndex(
        (p) => p.line === String(line.line),
      );
    await Child.collection.updateOne(
      { _id: child._id },
      { $inc: { [`quantityProgress.${index}.delivered`]: 1, version: 1 } },
    );
    const history =
      await require("../services/merchantFulfillment/quantity/reads").list(
        child._id,
        actor,
      );
    assert.equal(history.allocations[0].deliveryManaged, true);
    const before = (await Child.findById(child._id)).quantityProgress[index]
      .delivered;
    await assert.rejects(
      () =>
        require("../services/merchantFulfillment/quantity/commands").deliverAllocation(
          child._id,
          shipped.shipmentAllocation,
          {
            expectedVersion: saved.version + 1,
            idempotencyKey: "public-recovery-forbidden",
          },
          actor,
        ),
      /rider|dispatch/i,
    );
    const resolved = await engine.resolveManagedDelivery(
      booking._id,
      {
        expectedVersion: shipped.version,
        idempotencyKey: "bound-recovery",
        status: "delivered",
      },
      actor,
    );
    assert.equal(resolved.state, "delivered");
    assert.equal(
      (await Child.findById(child._id)).quantityProgress[index].delivered,
      before,
    );
    assert.equal((await Driver.findById(driver._id)).status, "available");
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        type: "shipped",
      }),
      1,
    );
    assert.equal(
      (await Allocation.findById(shipped.shipmentAllocation)).dispatchBooking,
      undefined,
    );
  },
);
