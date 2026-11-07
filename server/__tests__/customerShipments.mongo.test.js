"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "customer shipment JWT read binds original order/channel and projects only own safe recorded progress",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
      __dirname,
      "../routes/customerShipment.routes.js",
    );
    assert.ok(fs.existsSync(target), "customer shipment router exists");
    await connectVenueMongo(t, "customer_shipments");
    const keys = [
        "JWT_SECRET",
        "MERCHANT_FULFILLMENT_ENABLED",
        "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
      ],
      before = keys.map((k) => process.env[k]);
    keys.forEach(
      (k) =>
        (process.env[k] =
          k === "JWT_SECRET" ? "customer-shipments-test-only" : "true"),
    );
    t.after(() =>
      keys.forEach((k, i) =>
        before[i] === undefined
          ? delete process.env[k]
          : (process.env[k] = before[i]),
      ),
    );
    const {
      order,
      customer,
      actors,
      admin,
      mongoose,
      oid,
      Child,
      Order,
      a,
      b,
      foreign,
    } =
      await require("./helpers/customerShipmentFixture").customerShipmentFixture();
    const app = express();
    app.use("/api", require("../routes/customer-order-operations.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    async function call(actor, id = String(order._id), tail = "") {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/customer-shipments/${id}${tail}`,
        {
          headers: actor
            ? {
                Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
              }
            : {},
        },
      );
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        body: await response.json(),
      };
    }
    assert.equal((await call()).status, 401);
    for (const actor of [{ _id: foreign }, actors[0], admin])
      assert.equal((await call(actor)).status, 404);
    const owner = { _id: customer };
    await mongoose.disconnect();
    await mongoose.connect(
      uri.replace("?", `_customer_shipments_${process.pid}?`),
      {
        autoIndex: false,
        monitorCommands: true,
        serverSelectionTimeoutMS: 15000,
      },
    );
    const mongoClient = mongoose.connection.getClient(),
      commands = [];
    const observe = (event) => {
      if (event.commandName === "find") commands.push(event.command);
    };
    mongoClient.on("commandStarted", observe);
    const result = await call(owner);
    mongoClient.off("commandStarted", observe);
    const shipmentReads = commands.filter(
      (command) => command.find !== "users",
    );
    assert.equal(shipmentReads[0].readConcern?.level, "snapshot");
    assert.equal(shipmentReads[0].startTransaction, true);
    assert.ok(shipmentReads.length >= 8);
    assert.ok(
      shipmentReads.every(
        (command) =>
          command.autocommit === false &&
          String(command.txnNumber) === String(shipmentReads[0].txnNumber),
      ),
    );

    assert.equal(result.status, 200);
    assert.match(result.cache, /private.*no-store/);
    const data = result.body.data;
    assert.equal(data.managed, true);
    assert.equal(data.groups.length, 2);
    const booked = data.groups.find((g) => g.id === b._id).shipments;
    assert.equal(booked.length, 1);
    assert.equal(booked[0].status, "booked");
    assert.equal(booked[0].items[0].quantity, 1);
    const group = data.groups.find((g) => g.id === a._id);
    assert.equal(group.items[0].shipped, 1);
    assert.equal(group.items[0].cancelled, 1);
    assert.equal(group.shipments.length, 1);
    assert.equal(group.shipments[0].method, "local_delivery");
    assert.equal(group.shipments[0].status, "dispatched");
    assert.deepEqual(group.refunds, [
      { status: "needs_review", amountMinor: 1000, currency: "NGN" },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result.body),
      /PRIVATE_|financialBlocks|commission|tenantShare|movementReference|batchAllocations|shippedBy|createdBy|requestedBy|provider|account|"location"|ranges|reason|phone|email/i,
    );
    assert.equal((await call(owner, "invalid")).status, 404);
    assert.equal((await call(owner, String(oid()))).status, 404);
    assert.equal(
      (await call(owner, String(order._id), "?tenant=other")).status,
      400,
    );
    // Explicit V1 group status is allowed, without invented split allocations.
    await Child.collection.updateOne(
      { _id: b._id },
      {
        $unset: { fulfillmentVersion: "", quantityProgress: "" },
        $set: { state: "delivered" },
      },
    );
    await require("../models/MerchantShipment").collection.insertOne({
      _id: "pickup-own",
      merchantOrder: b._id,
      order: order._id,
      tenant: b.tenant,
      location: b.location,
      customer,
      provider: "pickup",
      status: "booked",
    });
    const v1 = (await call(owner)).body.data.groups.find((g) => g.id === b._id);
    assert.equal(v1.items[0].delivered, b.lines[0].quantity);
    assert.equal(
      v1.shipments.find((s) => s.method === "pickup").status,
      "delivered",
    );
    await Child.collection.updateOne(
      { _id: b._id },
      {
        $set: {
          fulfillmentVersion: 2,
          state: "delivered",
          quantityProgress: [
            {
              line: String(b.lines[0].line),
              shipped: 1,
              delivered: 1,
              cancelled: 1,
            },
          ],
        },
      },
    );
    const partialPickup = (await call(owner)).body.data.groups
      .find((g) => g.id === b._id)
      .shipments.find((s) => s.method === "pickup");
    assert.equal(partialPickup.items[0].quantity, 1);
    await Order.collection.updateOne(
      { _id: order._id },
      {
        $set: {
          salesChannel: "CUSTOM_MARKET",
          channelSnapshot: { kind: "marketplace" },
        },
      },
    );
    assert.equal((await call(owner)).status, 200);
    await Order.collection.updateOne(
      { _id: order._id },
      { $unset: { channelSnapshot: "" } },
    );
    // Original channel wins, even for the same user and managed-looking records.
    for (const changes of [
      { salesChannel: "WEBSITE_PRIVATE" },
      { salesChannel: "DRINKSHARBOUR_NG", integrationCheckout: "private" },
      {
        integrationCheckout: null,
        channelSnapshot: { kind: "storefront", apiKey: oid() },
      },
      { channelSnapshot: { kind: "pos" } },
      { channelSnapshot: { kind: "venue" } },
    ]) {
      await Order.collection.updateOne({ _id: order._id }, { $set: changes });
      assert.equal((await call(owner)).status, 404);
    }
    await Order.collection.updateOne(
      { _id: order._id },
      {
        $unset: {
          channelSnapshot: "",
          merchantFulfillmentVersion: "",
          integrationCheckout: "",
        },
        $set: { salesChannel: "DRINKSHARBOUR_NG" },
      },
    );
    assert.deepEqual((await call(owner)).body.data, {
      orderId: String(order._id),
      managed: false,
      groups: [],
    });
    // Read never changes goods or money state.
    assert.equal(
      (
        await require("../models/WarehouseStock")
          .findOne({ tenant: a.tenant })
          .lean()
      ).currentQuantity,
      10,
    );
    assert.equal(
      await require("../models/MerchantRefundAllocation").countDocuments({
        state: "uncertain",
      }),
      1,
    );
  },
);
