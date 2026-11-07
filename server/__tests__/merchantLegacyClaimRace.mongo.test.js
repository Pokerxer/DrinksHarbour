"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "legacy cancellation cannot release a pre-goods rider claim while physical stock is still in flight",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "merchant_legacy_cancel_claim");
    const before = process.env.MERCHANT_FULFILLMENT_ENABLED;
    delete process.env.MERCHANT_FULFILLMENT_ENABLED;
    t.after(() =>
      before === undefined
        ? delete process.env.MERCHANT_FULFILLMENT_ENABLED
        : (process.env.MERCHANT_FULFILLMENT_ENABLED = before),
    );
    const f = await require("./helpers/merchantQuantityFixture").fixture(),
      line = f.order.items[0],
      tenant = line.tenant,
      actor = f.actors[0],
      Order = require("../models/Order"),
      Driver = require("../models/Driver"),
      Stock = require("../models/WarehouseStock"),
      engine = require("../services/delivery.service");
    const order =
      await require("../services/storefrontLocationOrders").createMappedOrder(
        {
          user: f.customer,
          orderNumber: "LEGACY_CLAIM_" + new mongoose.Types.ObjectId(),
          currency: "NGN",
          subtotal: 10,
          totalAmount: 10,
          shippingFee: 0,
          taxAmount: 0,
          items: [
            {
              tenant,
              product: line.product,
              subproduct: line.subproduct,
              size: line.size,
              quantity: 1,
              priceAtPurchase: 10,
              itemSubtotal: 10,
              tenantRevenueShare: 8,
              platformCommission: 2,
            },
          ],
          paymentMethod: "card",
          paymentStatus: "paid",
          status: "confirmed",
          shippingMethod: "standard",
          shippingAddress: {
            fullName: "Synthetic",
            addressLine1: "Test",
            city: "Abuja",
            state: "FCT",
            country: "Nigeria",
          },
        },
        [f.tenants[0]],
      );
    const driver = await Driver.create({
        tenant,
        name: "Barrier rider",
        phone: "claim-race",
        vehicle: { type: "bike", capacityKg: 10 },
      }),
      trip = await engine.createDelivery(
        tenant,
        { orderIds: [order._id], driverId: driver._id },
        actor._id,
      );
    // A real owning transaction holds the stock row; no goods, DB or service method is mocked.
    const barrier = await mongoose.startSession();
    barrier.startTransaction();
    await Stock.collection.updateOne(
      { tenant },
      { $set: { claimRegressionBarrier: true } },
      { session: barrier },
    );
    let dispatch;
    try {
      dispatch = engine.dispatchDelivery(tenant, trip._id, actor._id).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      const end = Date.now() + 10000;
      let claimed;
      while (Date.now() < end) {
        claimed = await Driver.findById(driver._id).lean();
        if (String(claimed.legacyTrip) === String(trip._id)) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(
        String(claimed.legacyTrip),
        String(trip._id),
        "dispatch acquired actual durable claim before goods",
      );
      const cancelled = await engine
        .cancelDelivery(tenant, trip._id, "Concurrent cancel")
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      assert.ok(
        cancelled.error,
        "cancel must refuse durable dispatch claim until exact-trip reconciliation",
      );
      assert.equal(
        String((await Driver.findById(driver._id).lean()).legacyTrip),
        String(trip._id),
      );
      await assert.rejects(
        () => engine.updateDelivery(tenant, trip._id, { driverId: null }),
        /claim|reconciliation/i,
      );
    } finally {
      await barrier.abortTransaction();
      await barrier.endSession();
      if (dispatch) await dispatch;
    }
    assert.equal((await Order.findById(order._id).lean()).status, "shipped");
    assert.equal(
      (await require("../models/Delivery").findById(trip._id).lean()).status,
      "dispatched",
    );
    const Delivery = require("../models/Delivery");
    const freshDriver = await Driver.create({
      tenant,
      name: "Cancellation winner",
      phone: "cancel-first",
      vehicle: { type: "bike", capacityKg: 10 },
    });
    const freshTrip = await Delivery.create({
      tenant,
      deliveryNumber: "SYNTHETIC_CANCEL_FIRST",
      driver: freshDriver._id,
      status: "assigned",
      stops: [
        {
          order: order._id,
          sequence: 0,
          addressSnapshot: { fullName: "Synthetic" },
          status: "pending",
        },
      ],
    });
    await engine.updateDelivery(tenant, freshTrip._id, {
      notes: "Before dispatch",
    });
    const savedCancel = await engine.cancelDelivery(
      tenant,
      freshTrip._id,
      "Cancelled before claim",
    );
    assert.equal(savedCancel.status, "cancelled");
    await assert.rejects(
      () =>
        require("../services/delivery/driverClaim").claimLegacy(
          tenant,
          freshDriver._id,
          freshTrip._id,
        ),
      /changed|claim/i,
    );
    const unclaimed = await Driver.findById(freshDriver._id).lean();
    assert.equal(unclaimed.legacyTrip, null);
    assert.equal(unclaimed.status, "available");
  },
);
