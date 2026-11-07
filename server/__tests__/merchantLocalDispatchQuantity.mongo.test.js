"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "existing rider engine dispatches/delivers one exact merchant quantity allocation without parent replay",
  { skip: !uri },
  async (t) => {
    const engine = require("../services/delivery.service");
    assert.equal(
      typeof engine.dispatchManagedDelivery,
      "function",
      "managed branch of existing rider engine exists",
    );
    await connectVenueMongo(t, "merchant_dispatch_quantity");
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
    const { fixture } = require("./helpers/merchantQuantityFixture"),
      f = await fixture(),
      Child = require("../models/MerchantOrder"),
      Order = require("../models/Order"),
      Driver = require("../models/Driver"),
      Stock = require("../models/WarehouseStock"),
      Hold = require("../models/OnlineStockReservation");
    const child = await Child.findOne({
        order: f.order._id,
        tenant: f.actors[0].tenant,
      }).lean(),
      other = await Child.findOne({
        order: f.order._id,
        tenant: f.actors[1].tenant,
      }).lean(),
      actor = f.actors[0];
    await Order.collection.updateOne(
      { _id: f.order._id },
      {
        $set: {
          shippingMethod: "standard",
          "shippingAddress.coordinates": { latitude: 9.05, longitude: 7.4 },
        },
      },
    );
    for (const line of child.lines) {
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
    }
    await require("../services/merchantFulfillment/actions").act(
      child._id,
      {
        action: "accept",
        expectedVersion: 1,
        idempotencyKey: "dispatch-accept",
      },
      actor,
    );
    const service = require("../services/deliveryProviders/localDispatch");
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
        reviewReference: "synthetic-reviewed-free-local-leg",
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      },
      f.admin,
    );
    const driver = await Driver.create({
      tenant: child.tenant,
      name: "Synthetic rider",
      phone: "synthetic-quantity",
      vehicle: { type: "bike", capacityKg: 10 },
    });
    const quote = await service.quoteDispatch(
      child._id,
      { lines: [{ line: String(child.lines[0].line), quantity: 1 }] },
      actor,
    );
    const booking = await service.bookDispatch(
      child._id,
      {
        quoteId: String(quote._id),
        driverId: String(driver._id),
        idempotencyKey: "quantity-trip",
      },
      actor,
    );
    const input = {
      expectedVersion: booking.version,
      idempotencyKey: "quantity-dispatch",
    };
    await assert.rejects(
      () => engine.dispatchManagedDelivery(booking._id, input, f.actors[1]),
      /not found/i,
    );
    // A queued legacy run and managed child share a rider: only legacy may claim it.
    delete process.env.MERCHANT_FULFILLMENT_ENABLED;
    const legacyItem = child.lines[0],
      legacyOrder =
        await require("../services/storefrontLocationOrders").createMappedOrder(
          {
            user: f.customer,
            orderNumber: "SYNTHETIC_LEGACY_RACE",
            currency: "NGN",
            subtotal: 10,
            totalAmount: 10,
            discountTotal: 0,
            shippingFee: 0,
            taxAmount: 0,
            items: [
              {
                tenant: child.tenant,
                product: legacyItem.product,
                subproduct: legacyItem.subproduct,
                size: legacyItem.size,
                quantity: 1,
                priceAtPurchase: 10,
                itemSubtotal: 10,
                discountAmount: 0,
                tenantRevenueShare: 8,
                platformCommission: 2,
              },
            ],
            paymentMethod: "card",
            paymentStatus: "paid",
            status: "confirmed",
            shippingMethod: "standard",
            shippingAddress: {
              fullName: "Synthetic legacy recipient",
              addressLine1: "Synthetic",
              city: "Abuja",
              state: "FCT",
              country: "Nigeria",
            },
          },
          [f.tenants[0]],
        );
    process.env.MERCHANT_FULFILLMENT_ENABLED = "true";
    const legacyTrip = await engine.createDelivery(
      child.tenant,
      { orderIds: [legacyOrder._id], driverId: driver._id },
      actor._id,
    );
    const race = await Promise.allSettled([
      engine.dispatchManagedDelivery(booking._id, input, actor),
      engine.dispatchDelivery(child.tenant, legacyTrip._id, actor._id),
    ]);
    assert.equal(
      race[0].status,
      "rejected",
      "managed goods cannot leave on rider assigned to active legacy trip",
    );
    assert.equal(race[1].status, "fulfilled");
    assert.equal(
      String((await Driver.findById(driver._id)).legacyTrip),
      String(legacyTrip._id),
      "legacy owns durable pre-goods rider claim",
    );
    assert.equal(
      (await Child.findById(child._id)).quantityProgress.reduce(
        (n, row) => n + row.shipped,
        0,
      ),
      0,
    );
    assert.equal((await Order.findById(legacyOrder._id)).status, "shipped");
    await engine.resolveStop(
      child.tenant,
      legacyTrip._id,
      legacyTrip.stops[0]._id,
      { status: "delivered" },
      actor._id,
    );
    await engine.completeDelivery(child.tenant, legacyTrip._id);
    const initialStock = (await Stock.findOne({ tenant: child.tenant }))
        .currentQuantity,
      initialMovements =
        await require("../models/WarehouseMovement").countDocuments({
          type: "shipped",
        });
    delete process.env.MERCHANT_LOCAL_DISPATCH_ENABLED;
    const shipped = await Promise.all([
      engine.dispatchManagedDelivery(booking._id, input, actor),
      engine.dispatchManagedDelivery(booking._id, input, actor),
    ]);
    assert.equal(shipped[0].shipmentAllocation, shipped[1].shipmentAllocation);
    assert.equal(shipped[0].state, "dispatched");
    const allocation = await require("../models/MerchantShipmentAllocation")
      .findById(shipped[0].shipmentAllocation)
      .lean();
    assert.equal(allocation.lines.length, 1);
    assert.equal(allocation.lines[0].quantity, 1);
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "synthetic-dispatch-binding";
    t.after(() =>
      secret === undefined
        ? delete process.env.JWT_SECRET
        : (process.env.JWT_SECRET = secret),
    );
    const app = express();
    app.use(express.json());
    app.use("/api", require("../routes/merchant-operations.routes"));
    app.use((error, req, res, next) =>
      res.status(error.statusCode || 500).json({ message: error.message }),
    );
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const http = async (path, method = "GET", body) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/merchant-orders/${child._id}/quantity${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, body: await response.json() };
    };
    const childVersion = (await Child.findById(child._id)).version;
    const bypass = await http(
      `/allocations/${allocation._id}/deliver`,
      "POST",
      {
        expectedVersion: childVersion,
        idempotencyKey: "manual-must-not-close-rider-leg",
      },
    );
    assert.equal(bypass.status, 409, JSON.stringify(bypass.body));
    const spoof = await http(`/allocations/${allocation._id}/deliver`, "POST", {
      expectedVersion: childVersion,
      idempotencyKey: "browser-cannot-supply-binding",
      dispatchBooking: booking._id,
    });
    assert.equal(spoof.status, 400);
    const history = await http("/allocations");
    assert.equal(history.status, 200);
    assert.equal(
      history.body.data.allocations.find((row) => row._id === allocation._id)
        .deliveryManaged,
      true,
    );

    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).currentQuantity,
      initialStock - 1,
    );
    assert.equal(
      (await Stock.findOne({ tenant: other.tenant })).currentQuantity,
      10,
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        type: "shipped",
      }),
      initialMovements + 1,
    );
    assert.equal((await Child.findById(child._id)).state, "partially_shipped");
    assert.equal((await Child.findById(other._id)).state, "pending");
    assert.equal((await Driver.findById(driver._id)).status, "on_trip");
    const rows = await Hold.find({
      order: f.order._id,
      tenant: child.tenant,
    }).lean();
    assert.equal(
      rows.reduce((n, r) => n + (r.consumedQuantity || 0), 0),
      1,
    );
    await assert.rejects(
      () =>
        service.cancelBooking(
          booking._id,
          { idempotencyKey: "late-cancel", reason: "Already out with rider" },
          actor,
        ),
      /undispatched/i,
    );
    const resolvedInput = {
      expectedVersion: shipped[0].version,
      idempotencyKey: "quantity-deliver",
      status: "delivered",
      proofOfDelivery: {
        recipientName: "Synthetic recipient",
        note: "Synthetic operator observation",
      },
    };
    const resolved = await engine.resolveManagedDelivery(
      booking._id,
      resolvedInput,
      actor,
    );
    assert.equal(resolved.state, "delivered");
    await engine.resolveManagedDelivery(booking._id, resolvedInput, actor);
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).currentQuantity,
      initialStock - 1,
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        type: "shipped",
      }),
      initialMovements + 1,
    );
    assert.equal((await Driver.findById(driver._id)).status, "available");
    assert.equal(
      (await require("../models/Delivery").findById(booking.delivery)).status,
      "completed",
    );
    assert.equal(
      (await Order.findById(f.order._id)).status,
      "partially_shipped",
    );
  },
);
