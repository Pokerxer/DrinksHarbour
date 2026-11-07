"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "reviewed local dispatch quotes, books/cancels own rider responsibility and preserves legacy pickup",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
      __dirname,
      "../services/deliveryProviders/localDispatch",
    );
    const service = fs.existsSync(target + "/index.js") ? require(target) : {};
    assert.equal(
      typeof service.quoteDispatch,
      "function",
      "reviewed dispatch quote exists",
    );
    await connectVenueMongo(t, "merchant_local_dispatch");
    const oid = () => new mongoose.Types.ObjectId();
    const tenant = oid(),
      location = oid(),
      customer = oid(),
      parent = oid(),
      product = oid(),
      subproduct = oid(),
      size = oid(),
      line = oid(),
      foreign = oid();
    const actor = { _id: oid(), tenant, role: "tenant_owner" },
      root = { _id: oid(), role: "super_admin" },
      other = { _id: oid(), tenant: foreign, role: "tenant_owner" };
    const Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Warehouse = require("../models/Warehouse"),
      Driver = require("../models/Driver");
    await require("../models/Tenant").collection.insertOne({
      _id: tenant,
      status: "approved",
      subscriptionStatus: "active",
      isActive: true,
    });
    await Warehouse.create({
      _id: location,
      tenant,
      name: "Synthetic origin",
      code: "SYNTHETIC",
    });
    await Order.collection.insertOne({
      _id: parent,
      user: customer,
      merchantFulfillmentVersion: 2,
      settlementOwner: "platform",
      source: "web",
      currency: "NGN",
      paymentStatus: "paid",
      paymentMethod: "card",
      shippingMethod: "standard",
      shippingFee: 10,
      shippingAddress: {
        country: "Nigeria",
        state: "FCT",
        city: "Abuja",
        addressLine1: "Synthetic destination",
        coordinates: { latitude: 9.05, longitude: 7.4 },
      },
    });
    await require("../models/Product").collection.insertOne({
      _id: product,
      isAlcoholic: false,
      type: "soft_drink",
    });
    await require("../models/SubProduct").collection.insertOne({
      _id: subproduct,
      product,
      tenant,
      shipping: {
        fragile: false,
        hazmat: false,
        requiresAgeVerification: false,
      },
    });
    await require("../models/Size").collection.insertOne({
      _id: size,
      tenant,
      subproduct,
      shippingWeight: 1000,
      packaging: { type: "plastic_bottle", material: "plastic" },
    });
    const child = await Child.create({
      _id: "e".repeat(64),
      tenant,
      location,
      order: parent,
      currency: "NGN",
      lines: [
        {
          line,
          product,
          subproduct,
          size,
          quantity: 3,
          grossMinor: 3000,
          merchandiseMinor: 3000,
          tenantShareMinor: 2400,
          commissionMinor: 600,
        },
      ],
      allocationPolicy: "merchandise-weighted-v1",
      grossMinor: 3000,
      discountMinor: 0,
      merchandiseMinor: 3000,
      tenantShareMinor: 2400,
      commissionMinor: 600,
      shippingMinor: 1000,
      taxMinor: 0,
      totalMinor: 4000,
      state: "accepted",
      version: 1,
      fulfillmentVersion: 2,
    });
    const input = { lines: [{ line: String(line), quantity: 1 }] };
    const flag = process.env.MERCHANT_LOCAL_DISPATCH_ENABLED;
    t.after(() => {
      if (flag === undefined)
        delete process.env.MERCHANT_LOCAL_DISPATCH_ENABLED;
      else process.env.MERCHANT_LOCAL_DISPATCH_ENABLED = flag;
    });
    delete process.env.MERCHANT_LOCAL_DISPATCH_ENABLED;
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, actor),
      /disabled/i,
    );
    process.env.MERCHANT_LOCAL_DISPATCH_ENABLED = "true";
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, actor),
      /review|contract/i,
    );
    const config = {
      tenant: String(tenant),
      location: String(location),
      version: 1,
      currency: "NGN",
      amountMinor: 500,
      maxUnits: 3,
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
      capabilities: { alcohol: false, ageVerification: false, fragile: false },
      reviewReference: "synthetic-local-only",
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    await assert.rejects(
      () => service.reviewContract(config, actor),
      /platform|review/i,
    );
    const contract = await service.reviewContract(config, root);
    assert.equal(contract.reviewReference, "synthetic-local-only");
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, other),
      /not found/i,
    );
    const q = await service.quoteDispatch(
      child._id,
      { ...input, amountMinor: 1 },
      actor,
    );
    assert.equal(q.amountMinor, 500);
    assert.equal(q.provider, "local_dispatch");
    assert.equal(String(q.createdBy), String(actor._id));
    assert.equal(q.requirements.weightGrams, 1000);
    await require("../models/Size").collection.updateOne(
      { _id: size },
      { $set: { "packaging.type": "glass_bottle" } },
    );
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, actor),
      /fragile|capabil/i,
    );
    await require("../models/Size").collection.updateOne(
      { _id: size },
      { $set: { "packaging.type": "plastic_bottle" } },
    );
    await Order.collection.updateOne(
      { _id: parent },
      { $set: { "shippingAddress.coordinates.latitude": 8 } },
    );
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, actor),
      /coverage|destination/i,
    );
    await Order.collection.updateOne(
      { _id: parent },
      { $set: { "shippingAddress.coordinates.latitude": 9.05 } },
    );
    assert.equal(
      typeof service.getDispatchOptions,
      "function",
      "private reviewed options listing exists",
    );
    const driver = await Driver.create({
      tenant,
      name: "Synthetic rider",
      phone: "000-synthetic",
      vehicle: { type: "bike", capacityKg: 10 },
      status: "available",
    });
    const options = await service.getDispatchOptions(child._id, actor);
    assert.equal(options.contract.version, 1);
    assert.equal(options.drivers[0]._id, String(driver._id));
    assert.equal(JSON.stringify(options).includes(driver.phone), false);
    const bookingInput = {
      quoteId: String(q._id),
      driverId: String(driver._id),
      idempotencyKey: "dispatch-booking",
    };
    const bookings = await Promise.all([
      service.bookDispatch(child._id, bookingInput, actor),
      service.bookDispatch(child._id, bookingInput, actor),
    ]);
    assert.equal(bookings[0]._id, bookings[1]._id);
    assert.equal(await require("../models/Delivery").countDocuments(), 1);
    assert.equal((await Child.findById(child._id)).version, 1);
    const budget = await require("../models/MerchantDispatchBudget")
      .findById(child._id)
      .lean();
    assert.equal(budget.reservedMinor, 500);
    assert.equal(budget.committedMinor, 0);
    await assert.rejects(
      () => service.getBooking(bookings[0]._id, other),
      /not found/i,
    );
    await require("../models/MerchantDispatchBooking").collection.updateOne(
      { _id: bookings[0]._id },
      {
        $set: { "lines.0.costPrice": 12345 },
        $push: {
          events: {
            key: "private-projection-check",
            state: "booked",
            at: new Date(),
            source: "local_dispatch_operator",
            privateReceipt: "SYNTHETIC_PRIVATE_RECEIPT",
          },
        },
      },
    );
    const own = await service.getBooking(bookings[0]._id, actor);
    assert.equal(JSON.stringify(own).includes("shippingAddress"), false);
    assert.equal(own.state, "booked");
    assert.equal(JSON.stringify(own).includes("costPrice"), false);
    assert.equal(
      JSON.stringify(own).includes("SYNTHETIC_PRIVATE_RECEIPT"),
      false,
    );
    const legacy = require("../services/delivery.service");
    await assert.rejects(
      () => legacy.loadDelivery(tenant, bookings[0].delivery),
      /not found|managed/i,
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments(),
      0,
    );
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      User = require("../models/User");
    const secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "synthetic-local-dispatch-jwt";
    t.after(() =>
      secret === undefined
        ? delete process.env.JWT_SECRET
        : (process.env.JWT_SECRET = secret),
    );
    await User.collection.insertMany([
      { _id: actor._id, tenant, role: "tenant_owner", status: "active" },
      {
        _id: other._id,
        tenant: foreign,
        role: "tenant_owner",
        status: "active",
      },
      { _id: customer, role: "customer", status: "active" },
    ]);
    const app = express();
    app.use(express.json());
    app.use("/api", require("../routes/merchant-operations.routes"));
    app.use("/api/deliveries", require("../routes/delivery.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (user, method, suffix, body) => {
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}/api/merchant-local-dispatch${suffix}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(user
              ? {
                  Authorization: `Bearer ${jwt.sign({ userId: String(user) }, process.env.JWT_SECRET)}`,
                }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return {
        status: r.status,
        cache: r.headers.get("cache-control"),
        body: await r.json(),
      };
    };
    assert.equal(
      (await call(null, "GET", `/bookings/${bookings[0]._id}`)).status,
      401,
    );
    assert.equal(
      (await call(customer, "GET", `/bookings/${bookings[0]._id}`)).status,
      403,
    );
    assert.equal(
      (await call(other._id, "GET", `/bookings/${bookings[0]._id}`)).status,
      404,
    );
    const http = await call(actor._id, "GET", `/bookings/${bookings[0]._id}`);
    assert.equal(http.status, 200);
    assert.equal(http.cache, "private, no-store");
    assert.equal(Object.hasOwn(http.body.data.booking, "order"), false);
    assert.equal(JSON.stringify(http.body).includes("contractSnapshot"), false);
    assert.equal(
      (await call(actor._id, "POST", "/contracts", config)).status,
      403,
    );
    assert.equal(
      (await call(actor._id, "GET", `/orders/${child._id}/options`)).status,
      200,
    );
    const legacyList = await fetch(
      `http://127.0.0.1:${server.address().port}/api/deliveries`,
      {
        headers: {
          Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
        },
      },
    );
    assert.equal(legacyList.status, 200);
    assert.equal((await legacyList.json()).data.deliveries.length, 0);
    delete process.env.MERCHANT_LOCAL_DISPATCH_ENABLED;
    await service.cancelBooking(
      bookings[0]._id,
      { idempotencyKey: "cancel-draft", reason: "Synthetic cancellation" },
      actor,
    );
    await service.cancelBooking(
      bookings[0]._id,
      { idempotencyKey: "cancel-draft", reason: "Synthetic cancellation" },
      actor,
    );
    assert.equal(
      (await require("../models/MerchantDispatchBudget").findById(child._id))
        .reservedMinor,
      0,
    );
    assert.equal(
      (await require("../models/Delivery").findById(bookings[0].delivery))
        .status,
      "cancelled",
    );
    assert.equal((await Driver.findById(driver._id)).status, "available");
    process.env.MERCHANT_LOCAL_DISPATCH_ENABLED = "true";
    const expired = await service.quoteDispatch(child._id, input, actor);
    await require("../models/MerchantDispatchQuote").updateOne(
      { _id: expired._id },
      { $set: { expiresAt: new Date(0) } },
    );
    await assert.rejects(
      () =>
        service.bookDispatch(
          child._id,
          { quoteId: String(expired._id), idempotencyKey: "expired" },
          actor,
        ),
      /expired/i,
    );
    const stale = await service.quoteDispatch(child._id, input, actor);
    await require("../models/Size").collection.updateOne(
      { _id: size },
      { $set: { "packaging.type": "can" } },
    );
    await assert.rejects(
      () =>
        service.bookDispatch(
          child._id,
          { quoteId: String(stale._id), idempotencyKey: "changed-package" },
          actor,
        ),
      /scope.*changed/i,
    );
    await require("../models/Size").collection.updateOne(
      { _id: size },
      { $set: { "packaging.type": "plastic_bottle" } },
    );
    await service.revokeContract(contract._id, root);
    await assert.rejects(
      () => service.quoteDispatch(child._id, input, actor),
      /review|contract/i,
    );
    assert.equal(
      (await require("../models/MerchantDispatchBudget").findById(child._id))
        .committedMinor,
      0,
    );
  },
);
