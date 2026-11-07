"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "actual driver HTTP protects claimed availability and deactivation while preserving contact edits",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "merchant_driver_claim_http");
    const old = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "driver-claim-synthetic";
    t.after(() =>
      old === undefined
        ? delete process.env.JWT_SECRET
        : (process.env.JWT_SECRET = old),
    );
    const tenant = new mongoose.Types.ObjectId(),
      actor = new mongoose.Types.ObjectId(),
      Driver = require("../models/Driver");
    await require("../models/Tenant").collection.insertOne({
      _id: tenant,
      status: "approved",
      subscriptionStatus: "active",
    });
    await require("../models/User").collection.insertOne({
      _id: actor,
      tenant,
      role: "tenant_admin",
      status: "active",
    });
    const app = express();
    app.use(express.json());
    app.use("/drivers", require("../routes/driver.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (driver, method, body) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/drivers/${driver}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt.sign({ userId: String(actor) }, process.env.JWT_SECRET)}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, body: await response.json() };
    };
    for (const kind of ["legacyTrip", "managedTrip"]) {
      const trip = new mongoose.Types.ObjectId(),
        driver = await Driver.create({
          tenant,
          name: "Claimed rider",
          phone: kind,
          status: "available",
          [kind]: trip,
        });
      const change = await call(driver._id, "PATCH", { status: "off_duty" });
      assert.equal(
        change.status,
        400,
        `${kind} blocks status changes even during pre-goods availability`,
      );
      assert.equal(
        (await call(driver._id, "DELETE")).status,
        400,
        `${kind} blocks deactivation`,
      );
      const contact = await call(driver._id, "PATCH", {
        name: "Updated contact",
        notes: "Contact remains editable",
      });
      assert.equal(contact.status, 200);
      const stored = await Driver.findById(driver._id).lean();
      assert.equal(stored.status, "available");
      assert.equal(stored.isActive, true);
      assert.equal(String(stored[kind]), String(trip));
      assert.equal(stored.name, "Updated contact");
    }
    const free = await Driver.create({
      tenant,
      name: "Free rider",
      phone: "free",
    });
    assert.equal(
      (await call(free._id, "PATCH", { status: "off_duty" })).status,
      200,
    );
    assert.equal((await call(free._id, "DELETE")).status, 200);
  },
);
