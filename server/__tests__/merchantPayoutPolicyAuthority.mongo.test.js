"use strict";
// Merchant PAYOUT policy authority (workstream P) — immutable, versioned
// settlement-statement-linked payout-contract records. Mechanism, not policy:
// recording stores operator input verbatim (recorded contract fields the
// transfer command can consume: schedule/timing, currency rule, destination
// account SOURCE type, hold/clawback/netting rules, minimum threshold) with
// no defaults. Production contains no records; tests create explicitly
// synthetic ones, so every command surface stays fail-closed until a
// super_admin records a version.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(__dirname, "../models/MerchantPayoutPolicy.js");
const policyPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/policy.js",
);
const routePath = path.resolve(
  __dirname,
  "../routes/merchantPayoutPolicy.routes.js",
);

const PAYOUT_POLICY = {
  scheduleRule: "Weekly on the third business day after settlement",
  currencyMode: "original_transaction_currency",
  destinationAccountSource: "tenant_payout_account_reference",
  holdRegime: "recorded_holds_and_standing_minor",
  standingHoldMinor: 500,
  clawbackRule: "via_recorded_subsequent_hold",
  nettingRule: "statement_net_receivable_only",
  minimumThresholdMinor: 1000,
  decisionReference: "TEST-PAYOUT-DECISION-1",
};

test(
  "payout policy authority records immutable versioned contract records, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(modelPath), "MerchantPayoutPolicy model exists");
    assert.ok(
      fs.existsSync(policyPath),
      "payout/policy authority service exists",
    );
    assert.ok(fs.existsSync(routePath), "payout policy route exists");
    await connectVenueMongo(t, "payout_policy_authority");
    const Policy = require(modelPath);
    const policy = require(policyPath);
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const root = { _id: oid(), role: "super_admin" };
    const merchant = { _id: oid(), role: "tenant_owner", tenant: oid() };
    const admin = { _id: oid(), role: "admin" };

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(() => policy.record(PAYOUT_POLICY, merchant), /super admin/i);
    await assert.rejects(() => policy.record(PAYOUT_POLICY, admin), /super admin/i);
    assert.equal(await Policy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Structural validation: unrecorded fields stay unrecorded (no
    //    defaults); conversion rules only on conversion policy modes.
    await assert.rejects(
      () => policy.record({}, root),
      /schedule/i,
    );
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, currencyMode: "converted_to_home_currency" }, root),
      /currency mode/i,
    );
    await assert.rejects(
      () =>
        policy.record(
          {
            ...PAYOUT_POLICY,
            currencyMode: "recorded_fx_conversion",
            destinationCurrency: "gbp",
            fxSourceName: "verified-operator-fx-source",
            fxRateTimestampPolicy: "recorded_effective_date",
            fxMaxAgeMinutes: 30,
            fxRounding: "half_up",
          },
          root,
        ),
      /destination currency/i,
    );
    await assert.rejects(
      () =>
        policy.record(
          {
            ...PAYOUT_POLICY,
            currencyMode: "recorded_fx_conversion",
            destinationCurrency: "GBP",
            fxSourceName: "verified-operator-fx-source",
            fxRateTimestampPolicy: "live_polling",
            fxMaxAgeMinutes: 30,
            fxRounding: "half_up",
          },
          root,
        ),
      /timestamp policy/i,
    );
    await assert.rejects(
      () =>
        policy.record(
          { ...PAYOUT_POLICY, destinationAccountSource: "customer_bank_details" },
          root,
        ),
      /destination account source/i,
    );
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, clawbackRule: "auto_recover" }, root),
      /clawback rule/i,
    );
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, nettingRule: "carrier_offset" }, root),
      /netting rule/i,
    );
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, holdRegime: "standing_percentage_hold" }, root),
      /hold regime/i,
    );
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, minimumThresholdMinor: 0 }, root),
      /minimum threshold/i,
    );
    // A conversion mode policy must NOT record a standing hold on the
    // original currency statement; cross-field contamination is refused.
    assert.equal(await Policy.countDocuments(), 0);

    // 3. A super_admin records version 1; content stored verbatim, audited.
    const v1 = await policy.record(PAYOUT_POLICY, root);
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.equal(v1.scheduleRule, PAYOUT_POLICY.scheduleRule);
    assert.equal(v1.currencyMode, "original_transaction_currency");
    assert.equal(v1.destinationAccountSource, "tenant_payout_account_reference");
    assert.equal(v1.holdRegime, "recorded_holds_and_standing_minor");
    assert.equal(v1.standingHoldMinor, 500);
    assert.equal(v1.clawbackRule, "via_recorded_subsequent_hold");
    assert.equal(v1.nettingRule, "statement_net_receivable_only");
    assert.equal(v1.minimumThresholdMinor, 1000);
    assert.equal(v1.destinationCurrency, undefined);
    assert.equal(v1.fxSourceName, undefined);
    assert.equal(String(v1.recordedBy), String(root._id));
    assert.ok(v1.recordedAt);
    assert.match(v1.contentHash, /^[0-9a-f]{64}$/);
    const audit = await AuditLog.findOne({
      action: "MERCHANT_PAYOUT_POLICY_RECORD",
    }).lean();
    assert.ok(audit, "payout policy recording is audited");
    assert.equal(String(audit.actorUserId), String(root._id));
    assert.equal(audit.actorRole, "super_admin");

    // 4. Recorded contract policies are immutable.
    await assert.rejects(
      () => Policy.updateOne({ _id: v1._id }, { $set: { minimumThresholdMinor: 1 } }),
      /immutable/i,
    );
    await assert.rejects(() => Policy.deleteOne({ _id: v1._id }), /immutable/i);
    assert.equal(
      (await Policy.findById(v1._id).lean()).minimumThresholdMinor,
      1000,
    );

    // 5. Version collisions are rejected; the next decision is a new version.
    await assert.rejects(
      () => policy.record({ ...PAYOUT_POLICY, version: 1 }, root),
      /version/i,
    );
    const v2 = await policy.record(
      {
        ...PAYOUT_POLICY,
        standingHoldMinor: undefined,
        decisionReference: "TEST-PAYOUT-DECISION-2",
        effectiveFrom: new Date(Date.now() + 86400000),
      },
      root,
    );
    assert.equal(v2.version, 2);
    assert.equal(v2.standingHoldMinor, undefined);

    // 6. active() is fail-closed: newest in-window version governs.
    assert.equal(String((await policy.active())._id), String(v1._id));
    await policy.list(root);
    await assert.rejects(() => policy.list(merchant), /super admin/i);
    await assert.rejects(() => policy.list(admin), /super admin/i);
  },
);

test(
  "payout policy recording endpoint is super_admin-only over real JWT and lists recorded versions",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "payout_policy_route");
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
    process.env.JWT_SECRET = "payout-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-payout-policies", require(routePath));
    app.use((error, req, res, next) =>
      res.status(error.statusCode || 500).json({ message: error.message }),
    );
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-payout-policies`,
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

    // Tenant JWT is denied before any handler runs; nothing is written.
    assert.equal((await call({ _id: merchantId }, PAYOUT_POLICY)).status, 403);
    const Policy = require(modelPath);
    assert.equal(await Policy.countDocuments(), 0);

    // Super admin records through the endpoint; the version is listed back.
    const reply = await call({ _id: rootId }, PAYOUT_POLICY);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.data.policy.version, 1);
    assert.equal(
      reply.body.data.policy.destinationAccountSource,
      "tenant_payout_account_reference",
    );
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
  },
);
