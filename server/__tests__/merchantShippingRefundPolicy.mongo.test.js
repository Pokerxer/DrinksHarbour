"use strict";
// Shipping refund POLICY AUTHORITY (workstream S2) — immutable, versioned
// shipping-refund allocation policy records. Mechanism, not policy: the
// recording endpoint stores operator input verbatim (eligibility conditions,
// bearer outcome, journal treatment are recorded fields with no defaults).
// Production databases contain zero policy records; tests create explicitly
// synthetic ones.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(__dirname, "../models/MerchantShippingRefundPolicy.js");
const authorityPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/shippingRefund/policy.js",
);
const routePath = path.resolve(__dirname, "../routes/merchantShippingRefundPolicy.routes.js");
const Policy = require("../models/MerchantShippingRefundPolicy");
const authority = require("../services/merchantFulfillment/shippingRefund/policy");

const POLICY = {
  eligibilityConditions: ["failed_delivery", "carrier_fault"],
  bearerOutcome: "customer_refund_source",
  journalTreatment: "no_shipping_income_journal",
  decisionReference: "TEST-SHIPPING-DECISION-1",
};

test(
  "shipping refund policy authority records immutable versioned policies, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(require("node:fs").existsSync(modelPath), "policy model exists");
    assert.ok(require("node:fs").existsSync(authorityPath), "policy authority service exists");
    assert.ok(require("node:fs").existsSync(routePath), "policy route exists");
    await connectVenueMongo(t, "shipping_refund_policy");
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const root = { _id: oid(), role: "super_admin" };
    const merchant = { _id: oid(), role: "tenant_owner", tenant: oid() };

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(() => authority.record(POLICY, merchant), /super admin/i);
    assert.equal(await Policy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Unrecordable content is structurally rejected — the mechanism only
    //    records bearer/journal treatments it can bind as recorded data.
    await assert.rejects(
      () => authority.record({ ...POLICY, bearerOutcome: "carrier_pays_cash" }, root),
      /bearer/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, eligibilityConditions: ["late_delivery"] }, root),
      /condition/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, eligibilityConditions: [] }, root),
      /condition/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, journalTreatment: "reverse_9999" }, root),
      /journal/i,
    );
    assert.equal(await Policy.countDocuments(), 0);

    // 3. A super_admin records version 1; the record is audited.
    const v1 = await authority.record(POLICY, root);
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.deepEqual([...v1.eligibilityConditions].sort(), ["carrier_fault", "failed_delivery"]);
    assert.equal(v1.bearerOutcome, "customer_refund_source");
    assert.equal(v1.journalTreatment, "no_shipping_income_journal");
    assert.equal(String(v1.recordedBy), String(root._id));
    assert.ok(v1.recordedAt);
    assert.ok(v1.contentHash);
    const audit = await AuditLog.findOne({
      action: "MERCHANT_SHIPPING_REFUND_POLICY_RECORD",
    }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(String(audit.actorUserId), String(root._id));
    assert.equal(audit.actorRole, "super_admin");

    // 4. Recorded policies are immutable; a new decision is a new version.
    await assert.rejects(
      () => Policy.updateOne({ _id: v1._id }, { $set: { bearerOutcome: "merchant_bears" } }),
      /immutable/i,
    );
    await assert.rejects(() => Policy.deleteOne({ _id: v1._id }), /immutable/i);
    assert.equal(
      (await Policy.findById(v1._id).lean()).bearerOutcome,
      "customer_refund_source",
    );

    // 5. Version collisions are rejected; version 2 records and becomes active.
    await assert.rejects(() => authority.record({ ...POLICY, version: 1 }, root), /version/i);
    const v2 = await authority.record(
      { ...POLICY, bearerOutcome: "merchant_bears", decisionReference: "TEST-SHIPPING-DECISION-2" },
      root,
    );
    assert.equal(v2.version, 2);
    const active = await authority.active();
    assert.equal(String(active._id), String(v2._id));
    assert.equal(active.bearerOutcome, "merchant_bears");

    // 6. A version outside its effective window is recorded but not active.
    await authority.record(
      { ...POLICY, version: 3, effectiveFrom: new Date(Date.now() + 86400000) },
      root,
    );
    assert.equal(String((await authority.active())._id), String(v2._id));

    // 7. list is super_admin-only.
    await assert.rejects(() => authority.list(merchant), /super admin/i);
    assert.equal((await authority.list(root)).length, 3);
  },
);

test(
  "shipping refund policy recording endpoint is super_admin-only over real JWT",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "shipping_refund_policy_route");
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      User = require("../models/User");
    const rootId = new mongoose.Types.ObjectId(),
      merchantId = new mongoose.Types.ObjectId();
    await User.collection.insertMany([
      { _id: rootId, role: "super_admin", status: "active" },
      {
        _id: merchantId,
        role: "tenant_owner",
        status: "active",
        tenant: new mongoose.Types.ObjectId(),
      },
    ]);
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "shipping-refund-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-shipping-refund-policies", require(routePath));
    app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ message: e.message }));
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-shipping-refund-policies`,
        {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: result.status, body: await result.json().catch(() => null) };
    };

    assert.equal((await call({ _id: merchantId }, POLICY)).status, 403);
    assert.equal(await Policy.countDocuments(), 0);
    const reply = await call({ _id: rootId }, POLICY);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.data.policy.version, 1);
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
    assert.equal(list.body.data.policies[0].journalTreatment, "no_shipping_income_journal");
  },
);
