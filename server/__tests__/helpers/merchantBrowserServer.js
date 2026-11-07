"use strict";
// Disposable local browser fixture. Never imports application startup or dotenv.
const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("node:path");
const { connectVenueMongo } = require("./venueMongo");
async function main() {
  process.env.MERCHANT_FULFILLMENT_ENABLED = "true";
  process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED = "true";
  process.env.JWT_SECRET = "merchant-browser-synthetic-only";
  const cleanup = [];
  await connectVenueMongo({ after: (fn) => cleanup.push(fn) }, "merchant_browser");
  const { fixture } = require("./merchantQuantityFixture");
  const data = await fixture();
  const actor = data.actors[0];
  const token = jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const { encode } = require(path.resolve(__dirname,
    "../../../client/apps/admin/node_modules/next-auth/jwt"));
  const cookie = await encode({
    secret: "merchant-browser-next-auth-synthetic-only",
    token: {
      id: String(actor._id), role: actor.role, tenantId: String(actor.tenant),
      accessToken: token, name: "Synthetic Merchant", email: "browser@example.test",
      subscriptionStatus: "active", plan: "pro",
    },
  });
  const Child = require("../../models/MerchantOrder");
  const child = await Child.findOne({ order: data.order._id, tenant: actor.tenant }).lean();
  const app = express();
  app.use((req, res, next) => {
    if (req.headers.origin === "http://127.0.0.1:39142") {
      res.set("Access-Control-Allow-Origin", req.headers.origin);
      res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
      res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json());
  app.get("/__test/state", (req, res) => res.json({ cookie, child: String(child._id) }));
  app.get("/__test/summary", async (req, res, next) => {
    try {
      const own = await Child.findById(child._id).lean();
      const stock = await require("../../models/WarehouseStock").findOne({
        tenant: actor.tenant, size: child.lines[0].size,
      }).lean();
      const allocations = await require("../../models/MerchantShipmentAllocation")
        .find({ merchantOrder: child._id }).lean();
      res.json({ state: own.state, version: own.version,
        progress: own.quantityProgress, stock: stock.currentQuantity,
        reserved: stock.reservedQuantity, allocations: allocations.length,
        delivered: allocations.filter((row) => row.state === "delivered").length });
    } catch (error) { next(error); }
  });
  app.use("/api", require("../../routes/merchant-operations.routes"));
  app.use((error, req, res, next) => res.status(error.statusCode || 500)
    .json({ success: false, message: error.message }));
  const server = app.listen(39140, "127.0.0.1", () => console.log("merchant browser fixture ready"));
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(resolve));
    for (const fn of cleanup.reverse()) await fn();
    process.exit(0);
  }
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
main().catch((error) => { console.error(error); process.exit(1); });
