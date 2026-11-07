"use strict";
// Provider fee bearer treatment POLICY AUTHORITY (workstream Fb) — immutable,
// versioned fee-treatment policy records. Mechanism, not policy: recording is
// super_admin-only and audited and stores operator input verbatim (flow
// binding, bearer, future-journal treatment, historical-fee rule are recorded
// fields with no defaults). Production databases contain zero policy records;
// tests create explicitly synthetic ones. This is a PURE RECORD authority —
// no fee journal exists in the marketplace path and no writer is built here
// (see feeTreatment/policy.js + projection.js).
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(__dirname, "../models/MerchantFeeTreatmentPolicy.js");
const authorityPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/feeTreatment/policy.js",
);
const routePath = path.resolve(__dirname, "../routes/merchantFeeTreatmentPolicy.routes.js");
const Policy = require("../models/MerchantFeeTreatmentPolicy");
const authority = require("../services/merchantFulfillment/feeTreatment/policy");

const POLICY = {
  flows: ["merchandise_refund", "shipping_refund"],
  bearer: "customer_refund_share",
  futureJournalTreatment: "no_provider_fee_journal_until_fee_account_exists",
  historicalFeeRule: "none_recorded_stays_unknown",
  decisionReference: "TEST-FEE-DECISION-1",
};

test(
  "fee treatment policy authority records immutable versioned policies, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(modelPath), "fee treatment policy model exists");
    assert.ok(fs.existsSync(authorityPath), "fee treatment policy authority service exists");
    assert.ok(fs.existsSync(routePath), "fee treatment policy route exists");
    await connectVenueMongo(t, "fee_treatment_policy");
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const root = { _id: oid(), role: "super_admin" };
    const merchant = { _id: oid(), role: "tenant_owner", tenant: oid() };

    // 1. Tenant actors are denied recording; nothing at all is written.
    await assert.rejects(() => authority.record(POLICY, merchant), /super admin/i);
    assert.equal(await Policy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Unrecordable content is structurally rejected — the mechanism only
    //    records the bearer outcomes and treatments it can surface as data.
    await assert.rejects(
      () => authority.record({ ...POLICY, flows: [] }, root),
      /flow/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, flows: ["merchandise_refund", "instant_settlement"] }, root),
      /flow/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, bearer: "tenant_bears_without_record" }, root),
      /bearer/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, futureJournalTreatment: "post_to_5200_expense" }, root),
      /journal/i,
    );
    await assert.rejects(
      () => authority.record({ ...POLICY, historicalFeeRule: "backfill_from_gateway_exports" }, root),
      /historical/i,
    );
    assert.equal(await Policy.countDocuments(), 0);

    // 3. A super_admin records version 1; the record is audited.
    const v1 = await authority.record(POLICY, root);
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.deepEqual([...v1.flows].sort(), ["merchandise_refund", "shipping_refund"]);
    assert.equal(v1.bearer, "customer_refund_share");
    assert.equal(v1.historicalFeeRule, "none_recorded_stays_unknown");
    assert.equal(String(v1.recordedBy), String(root._id));
    assert.ok(v1.recordedAt);
    assert.ok(v1.contentHash);
    const audit = await AuditLog.findOne({
      action: "MERCHANT_FEE_TREATMENT_POLICY_RECORD",
    }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(String(audit.actorUserId), String(root._id));
    assert.equal(audit.actorRole, "super_admin");

    // 4. Recorded policies are immutable; a new decision is a new version.
    await assert.rejects(
      () => Policy.updateOne({ _id: v1._id }, { $set: { bearer: "merchant_bears" } }),
      /immutable/i,
    );
    await assert.rejects(() => Policy.deleteOne({ _id: v1._id }), /immutable/i);
    assert.equal((await Policy.findById(v1._id).lean()).bearer, "customer_refund_share");

    // 5. Version collisions are rejected; the next version records.
    await assert.rejects(() => authority.record({ ...POLICY, version: 1 }, root), /version/i);
    const v2 = await authority.record(
      {
        flows: ["payout", "kora_refund"],
        bearer: "merchant_bears",
        futureJournalTreatment: "future_provider_fee_expense_journal_required",
        historicalFeeRule: "historical_fees_unrecorded_requires_measurement",
        decisionReference: "TEST-FEE-DECISION-2",
      },
      root,
    );
    assert.equal(v2.version, 2);

    // 6. Per-flow resolution: newest in-window version binding a flow governs.
    const payoutActive = await authority.activeForFlow("payout");
    assert.equal(String(payoutActive._id), String(v2._id));
    const merchActive = await authority.activeForFlow("merchandise_refund");
    assert.equal(String(merchActive._id), String(v1._id));
    assert.equal(merchActive.bearer, "customer_refund_share");

    // 7. A version outside its effective window is recorded but not active.
    const v3 = await authority.record(
      {
        ...POLICY,
        flows: ["carrier_recovery"],
        bearer: "carrier_recovery",
        version: 3,
        effectiveFrom: new Date(Date.now() + 86400000),
      },
      root,
    );
    assert.equal(v3.version, 3);
    assert.equal(
      await authority.activeForFlow("carrier_recovery"),
      null,
      "future-effective version does not yet govern",
    );
    assert.equal((await authority.activeForFlow("shipping_refund")).version, 1);

    // 8. Unknown flows resolve to null (fail closed), not an error state that
    //    could be mistaken for a recorded decision.
    assert.equal(await authority.activeForFlow("teleport_refund"), null);

    // 9. list is super_admin-only.
    await assert.rejects(() => authority.list(merchant), /super admin/i);
    assert.equal((await authority.list(root)).length, 3);
  },
);

test(
  "fee treatment policy recording endpoint is super_admin-only over real JWT",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "fee_treatment_policy_route");
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
    process.env.JWT_SECRET = "fee-treatment-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-fee-treatment-policies", require(routePath));
    app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ message: e.message }));
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-fee-treatment-policies`,
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
    assert.ok(reply.body.data.policy.contentHash);
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
    assert.equal(list.body.data.policies[0].historicalFeeRule, "none_recorded_stays_unknown");
  },
);
