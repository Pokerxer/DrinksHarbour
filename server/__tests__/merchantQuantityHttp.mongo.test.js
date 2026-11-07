"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "quantity HTTP requires real JWT ownership and returns only own immutable allocation quantities",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
      __dirname,
      "../routes/merchantQuantity.routes.js",
    );
    assert.ok(fs.existsSync(target), "quantity HTTP router exists");
    await connectVenueMongo(t, "merchant_quantity_http");
    const keys = [
        "MERCHANT_FULFILLMENT_ENABLED",
        "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
        "JWT_SECRET",
      ],
      before = keys.map((key) => process.env[key]);
    for (const key of keys)
      process.env[key] =
        key === "JWT_SECRET" ? "quantity-http-test-only" : "true";
    t.after(() =>
      keys.forEach((key, i) =>
        before[i] === undefined
          ? delete process.env[key]
          : (process.env[key] = before[i]),
      ),
    );
    const { fixture } = require("./helpers/merchantQuantityFixture"),
      { order, actors, tenants } = await fixture(),
      Child = require("../models/MerchantOrder"),
      Stock = require("../models/WarehouseStock");
    const a = await Child.findOne({
        order: order._id,
        tenant: tenants[0]._id,
      }).lean(),
      line = String(a.lines[0].line);
    await require("../services/merchantFulfillment/actions").act(
      a._id,
      { action: "accept", expectedVersion: 1, idempotencyKey: "accept-http" },
      actors[0],
    );
    const app = express();
    app.use(express.json());
    app.use("/merchant-orders/:id/quantity", require(target));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, method, tail, body) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-orders/${a._id}/quantity${tail}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(actor
              ? {
                  Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
                }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        body: await response.json(),
      };
    };
    assert.equal((await call(null, "GET", "/allocations")).status, 401);
    const input = {
      lines: [{ line, quantity: 1 }],
      expectedVersion: 2,
      idempotencyKey: "ship-http",
    };
    assert.equal((await call(actors[1], "POST", "/ship", input)).status, 404);
    assert.equal(
      (
        await call(actors[0], "POST", "/ship", {
          ...input,
          tenant: String(tenants[1]._id),
        })
      ).status,
      400,
    );
    assert.equal(
      (await call(actors[0], "POST", "/ship", { ...input, lines: [null] }))
        .status,
      400,
    );
    const shipped = await call(actors[0], "POST", "/ship", input);
    assert.equal(shipped.status, 201);
    assert.match(shipped.cache, /no-store/);
    const allocation = shipped.body.data.allocation;
    assert.equal(allocation.lines[0].quantity, 1);
    assert.equal(allocation.lines[0].ranges[0].start, 0);
    assert.equal(
      (await call(actors[0], "POST", "/ship", input)).body.data.allocation._id,
      allocation._id,
    );
    assert.equal((await call(actors[1], "GET", "/allocations")).status, 404);
    const listed = await call(actors[0], "GET", "/allocations");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.allocations.length, 1);
    assert.doesNotMatch(
      JSON.stringify(listed.body),
      /shippedBy|movementReference|commissionMinor|tenantShareMinor|batchAllocations|provider|payment/i,
    );
    assert.equal(
      (
        await call(
          actors[0],
          "POST",
          `/allocations/${allocation._id}/deliver`,
          { expectedVersion: 3, idempotencyKey: "delivered-http" },
        )
      ).status,
      200,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      9,
    );
    assert.equal(
      (
        await call(actors[0], "POST", "/cancel", {
          lines: [{ line, quantity: 1 }],
          expectedVersion: 4,
          idempotencyKey: "no-refund",
        })
      ).status,
      409,
    );
  },
);
