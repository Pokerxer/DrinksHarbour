"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "version2 partial line shipments retain exact stock and original batches with replay, foreign denial and delivered allocations",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
        __dirname,
        "../services/merchantFulfillment/quantity/commands.js",
      ),
      commands = fs.existsSync(target) ? require(target) : {};
    assert.equal(typeof commands.shipQuantities, "function");
    await connectVenueMongo(t, "merchant_quantity");
    const before = [
      process.env.MERCHANT_FULFILLMENT_ENABLED,
      process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED,
    ];
    process.env.MERCHANT_FULFILLMENT_ENABLED = "true";
    process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED = "true";
    t.after(() => {
      for (const [index, key] of [
        "MERCHANT_FULFILLMENT_ENABLED",
        "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
      ].entries())
        if (before[index] === undefined) delete process.env[key];
        else process.env[key] = before[index];
    });
    const { order, actors, tenants } =
      await require("./helpers/merchantQuantityFixture").fixture();
    assert.equal(order.merchantFulfillmentVersion, 2);
    const Child = require("../models/MerchantOrder"),
      Hold = require("../models/OnlineStockReservation"),
      Stock = require("../models/WarehouseStock"),
      Order = require("../models/Order");
    const a = await Child.findOne({
        order: order._id,
        tenant: tenants[0]._id,
      }).lean(),
      b = await Child.findOne({
        order: order._id,
        tenant: tenants[1]._id,
      }).lean();
    assert.equal(a.fulfillmentVersion, 2);
    assert.equal(
      await Hold.countDocuments({ order: order._id, reservationVersion: 2 }),
      3,
    );
    await require("../services/merchantFulfillment/actions").act(
      a._id,
      { action: "accept", expectedVersion: 1, idempotencyKey: "accept-v2" },
      actors[0],
    );
    assert.equal((await Order.findById(order._id).lean()).status, "processing");
    const line = a.lines.find((row) => row.quantity === 3),
      input = {
        lines: [{ line: String(line.line), quantity: 1 }],
        expectedVersion: 2,
        idempotencyKey: "first-unit",
      };
    const savedHold = await Hold.findOne({
      order: order._id,
      fulfillmentLineId: String(line.line),
    }).lean();
    await Hold.collection.updateOne(
      { _id: savedHold._id },
      { $set: { product: new mongoose.Types.ObjectId() } },
    );
    await assert.rejects(
      () =>
        commands.shipQuantities(
          a._id,
          { ...input, idempotencyKey: "corrupt-hold" },
          actors[0],
        ),
      /identity|reservation|reconciliation/i,
    );
    await Hold.collection.updateOne(
      { _id: savedHold._id },
      { $set: { product: savedHold.product } },
    );
    const results = await Promise.all([
      commands.shipQuantities(a._id, input, actors[0]),
      commands.shipQuantities(a._id, input, actors[0]),
    ]);
    assert.equal(results[0]._id, results[1]._id);
    assert.deepEqual(
      results[0].lines[0].ranges.map((r) => ({
        start: r.start,
        quantity: r.quantity,
      })),
      [{ start: 0, quantity: 1 }],
    );
    await require("../services/merchantFulfillment/actions").act(
      b._id,
      {
        action: "accept",
        expectedVersion: 1,
        idempotencyKey: "sibling-after-partial",
      },
      actors[1],
    );
    assert.equal(
      (await Order.findById(order._id).lean()).status,
      "partially_shipped",
    );
    const reordered = await commands.shipQuantities(
      a._id,
      {
        idempotencyKey: input.idempotencyKey,
        expectedVersion: input.expectedVersion,
        lines: input.lines,
      },
      actors[0],
    );
    assert.equal(reordered._id, results[0]._id);
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      9,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).reservedQuantity,
      4,
    );
    await assert.rejects(
      () =>
        commands.shipQuantities(
          a._id,
          { ...input, lines: [{ line: String(line.line), quantity: 2 }] },
          actors[0],
        ),
      /key|another/i,
    );
    await assert.rejects(
      () =>
        commands.shipQuantities(
          a._id,
          { ...input, idempotencyKey: "foreign" },
          actors[1],
        ),
      /not found/i,
    );
    await assert.rejects(
      () =>
        require("../services/merchantFulfillment/actions").act(
          a._id,
          { action: "ship", expectedVersion: 3, idempotencyKey: "whole-v2" },
          actors[0],
        ),
      /quantity|version/i,
    );
    delete process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED;
    const second = await commands.shipQuantities(
      a._id,
      {
        lines: [{ line: String(line.line), quantity: 2 }],
        expectedVersion: 3,
        idempotencyKey: "remaining-two",
      },
      actors[0],
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      7,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[1]._id }).lean()).currentQuantity,
      10,
    );
    assert.equal(
      second.lines[0].batchAllocations.reduce((n, r) => n + r.quantity, 0),
      2,
    );
    assert.equal(
      (await Order.findById(order._id).lean()).status,
      "partially_shipped",
    );
    const hold = await Hold.findOne({
      order: order._id,
      fulfillmentLineId: String(line.line),
    }).lean();
    assert.equal(hold.quantity, 3);
    assert.equal(hold.consumedQuantity, 3);
    assert.equal(hold.releasedQuantity, 0);
    const beforeDelivery = (await Child.findById(a._id).lean()).version;
    await commands.deliverAllocation(
      a._id,
      results[0]._id,
      { expectedVersion: beforeDelivery, idempotencyKey: "deliver-first" },
      actors[0],
    );
    await commands.deliverAllocation(
      a._id,
      results[0]._id,
      { expectedVersion: beforeDelivery, idempotencyKey: "deliver-first" },
      actors[0],
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      7,
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        tenant: tenants[0]._id,
        type: "shipped",
      }),
      2,
    );
    const secondLine = a.lines.find((row) => row.quantity === 2),
      beforeRollback = (await Child.findById(a._id).lean()).version;
    await assert.rejects(
      () =>
        commands.shipQuantities(
          a._id,
          {
            lines: [
              { line: String(secondLine.line), quantity: 1 },
              { line: "ffffffffffffffffffffffff", quantity: 1 },
            ],
            expectedVersion: beforeRollback,
            idempotencyKey: "rollback-later-invalid-line",
          },
          actors[0],
        ),
      /line|owned/i,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      7,
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        tenant: tenants[0]._id,
        type: "shipped",
      }),
      2,
    );
    const currentVersion = (await Child.findById(a._id).lean()).version;
    await assert.rejects(
      () =>
        commands.shipQuantities(
          a._id,
          {
            lines: [{ line: String(b.lines[0].line), quantity: 1 }],
            expectedVersion: currentVersion,
            idempotencyKey: "foreign-line",
          },
          actors[0],
        ),
      /line|owned/i,
    );
    const competed = await Promise.allSettled(
      ["last-a", "last-b"].map((key) =>
        commands.shipQuantities(
          a._id,
          {
            lines: [{ line: String(secondLine.line), quantity: 2 }],
            expectedVersion: beforeRollback,
            idempotencyKey: key,
          },
          actors[0],
        ),
      ),
    );
    assert.equal(
      competed.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      competed.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      5,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).reservedQuantity,
      0,
    );
  },
);
