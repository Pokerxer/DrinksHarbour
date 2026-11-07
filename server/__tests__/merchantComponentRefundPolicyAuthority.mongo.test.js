"use strict";
// Merchant component refund POLICY AUTHORITY (workstream T) — immutable,
// versioned tax/discount component-refund policy records. Mechanism, not
// policy: recording stores operator input verbatim (per-kind recorded rules
// with no defaults). Production contains no records; tests create explicitly
// synthetic ones, so every command surface stays fail-closed until a
// super_admin records a version.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(
  __dirname,
  "../models/MerchantComponentRefundPolicy.js",
);
const policyPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/componentRefund/policy.js",
);
const routePath = path.resolve(
  __dirname,
  "../routes/merchantComponentRefundPolicy.routes.js",
);

const TAX_POLICY = {
  kind: "tax",
  jurisdiction: "NG-FCT",
  rateAuthority: "FIRS",
  bearer: "platform",
  reversalTreatment: "no_output_vat_captured",
  decisionReference: "TEST-TAX-DECISION-1",
};
const DISCOUNT_POLICY = {
  kind: "discount",
  eligibleFunding: ["platform", "shared_by_agreement"],
  platformRecreditPath: "component_record_only",
  decisionReference: "TEST-DISCOUNT-DECISION-1",
};

test(
  "component refund policy authority records immutable versioned policies, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(modelPath), "MerchantComponentRefundPolicy model exists");
    assert.ok(fs.existsSync(policyPath), "componentRefund/policy authority exists");
    assert.ok(fs.existsSync(routePath), "component refund policy route exists");
    await connectVenueMongo(t, "component_policy_authority");
    const Policy = require(modelPath);
    const policy = require(policyPath);
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const root = { _id: oid(), role: "super_admin" };
    const merchant = { _id: oid(), role: "tenant_owner", tenant: oid() };

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(() => policy.record(TAX_POLICY, merchant), /super admin/i);
    assert.equal(await Policy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Per-kind structural validation: each kind records only its own rules.
    await assert.rejects(
      () => policy.record({ ...TAX_POLICY, eligibleFunding: ["platform"] }, root),
      /only to discount policies/i,
    );
    await assert.rejects(
      () =>
        policy.record(
          {
            ...DISCOUNT_POLICY,
            jurisdiction: "NG-FCT",
            reversalTreatment: "no_output_vat_captured",
          },
          root,
        ),
      /only to tax policies/i,
    );
    await assert.rejects(
      () => policy.record({ ...DISCOUNT_POLICY, eligibleFunding: ["platform", "vendor_funded"] }, root),
      /discount funding value/i,
    );
    await assert.rejects(
      () => policy.record({ ...DISCOUNT_POLICY, eligibleFunding: [] }, root),
      /discount funding value/i,
    );
    await assert.rejects(
      () => policy.record({ ...TAX_POLICY, reversalTreatment: "reissue_credit_note" }, root),
      /not executable by the mechanism/i,
    );
    assert.equal(await Policy.countDocuments(), 0);

    // 3. A super_admin records tax version 1; the record is audited and the
    //    content is stored verbatim (no defaults invented).
    const v1 = await policy.record(TAX_POLICY, root);
    assert.equal(v1.kind, "tax");
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.equal(v1.jurisdiction, "NG-FCT");
    assert.equal(v1.rateAuthority, "FIRS");
    assert.equal(v1.bearer, "platform");
    assert.equal(v1.reversalTreatment, "no_output_vat_captured");
    assert.equal(v1.eligibleFunding, undefined);
    assert.equal(v1.platformRecreditPath, undefined);
    assert.equal(String(v1.recordedBy), String(root._id));
    assert.ok(v1.recordedAt);
    assert.ok(v1.contentHash);
    const audit = await AuditLog.findOne({
      action: "MERCHANT_COMPONENT_REFUND_POLICY_RECORD",
    }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(String(audit.actorUserId), String(root._id));
    assert.equal(audit.actorRole, "super_admin");

    // 4. Recorded policies are immutable: any update or delete of an existing
    //    version is rejected; a new commercial decision is a new version.
    await assert.rejects(
      () => Policy.updateOne({ _id: v1._id }, { $set: { bearer: "merchant" } }),
      /immutable/i,
    );
    await assert.rejects(() => Policy.deleteOne({ _id: v1._id }), /immutable/i);
    assert.equal((await Policy.findById(v1._id).lean()).bearer, "platform");

    // 5. Version collisions are rejected; a discount version records its
    //    funding-bound eligibility and re-credit path verbatim.
    await assert.rejects(() => policy.record({ ...TAX_POLICY, version: 1 }, root), /version/i);
    const d1 = await policy.record(DISCOUNT_POLICY, root);
    assert.equal(d1.kind, "discount");
    assert.equal(d1.version, 1);
    assert.deepEqual(d1.eligibleFunding, ["platform", "shared_by_agreement"]);
    assert.equal(d1.platformRecreditPath, "component_record_only");
    assert.equal(d1.jurisdiction, undefined);
    assert.equal(d1.reversalTreatment, undefined);
    assert.equal(String((await policy.active("tax"))._id), String(v1._id));
    assert.equal(String((await policy.active("discount"))._id), String(d1._id));

    // 6. active() is fail-closed: unknown kind → null; a newest version
    //    outside its effective window is skipped in favour of the newest
    //    in-window version.
    assert.equal(await policy.active("shipping"), null);
    const d2 = await policy.record(
      {
        ...DISCOUNT_POLICY,
        decisionReference: "TEST-DISCOUNT-DECISION-2",
        effectiveFrom: new Date(Date.now() + 86400000),
      },
      root,
    );
    assert.equal(d2.version, 2);
    assert.equal(String((await policy.active("discount"))._id), String(d1._id));
    await policy.list(root); // super_admin-only read resolves
    await assert.rejects(() => policy.list(merchant), /super admin/i);
  },
);

test(
  "recording endpoint is super_admin-only over real JWT and lists recorded versions",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "component_policy_route");
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
    process.env.JWT_SECRET = "component-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-component-refund-policies", require(routePath));
    app.use((error, req, res, next) =>
      res.status(error.statusCode || 500).json({ message: error.message }),
    );
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-component-refund-policies`,
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

    // Tenant JWT is denied before any handler runs.
    assert.equal((await call({ _id: merchantId }, TAX_POLICY)).status, 403);
    const Policy = require(modelPath);
    assert.equal(await Policy.countDocuments(), 0);

    // Super admin records through the endpoint; the version is listed back.
    const reply = await call({ _id: rootId }, TAX_POLICY);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.data.policy.version, 1);
    assert.equal(reply.body.data.policy.reversalTreatment, "no_output_vat_captured");
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
    assert.equal(list.body.data.policies[0].kind, "tax");
  },
);


// WT-HARDENING (review fixes 1+2): concurrent same-version recording surfaces
// the explicit conflict (never a raw duplicate-key error), and active()
// resolves an in-window version no matter how many newer versions exist.
test(
  "concurrent recording of one explicit version persists exactly one row and surfaces the explicit conflict",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "component_policy_record_race");
    const Policy = require(modelPath);
    const policy = require(policyPath);
    // The declared {kind,version} unique index must really exist for the
    // duplicate-key path to fire (autoIndex is disabled everywhere).
    await Policy.syncIndexes();
    const root = { _id: new mongoose.Types.ObjectId(), role: "super_admin" };
    const attempt = (n) => policy.record({ ...TAX_POLICY, version: 1, decisionReference: n }, root);
    const results = await Promise.allSettled([
      attempt("TEST-RACE-A"),
      attempt("TEST-RACE-B"),
      attempt("TEST-RACE-C"),
      attempt("TEST-RACE-D"),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    assert.equal(won.length, 1);
    assert.equal(lost.length, 3);
    assert.equal(won[0].value.version, 1);
    for (const row of lost) {
      // The loser surfaces the EXPLICIT conflict, never a raw duplicate-key
      // error from the recording race.
      assert.equal(row.reason.statusCode, 409);
      assert.match(row.reason.message, /already exists for this kind/);
    }
    assert.equal(await Policy.countDocuments({ kind: "tax", version: 1 }), 1);
    // Auto-sequenced concurrent versions retry into the next free version.
    const auto = await Promise.allSettled([
      policy.record({ ...TAX_POLICY, decisionReference: "TEST-RACE-E" }, root),
      policy.record({ ...TAX_POLICY, decisionReference: "TEST-RACE-F" }, root),
    ]);
    assert.equal(auto.filter((r) => r.status === "fulfilled").length, 2);
    assert.equal(await Policy.countDocuments(), 3);
  },
);

test(
  "active() resolves an in-window version even when many newer versions exist",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "component_policy_window");
    const Policy = require(modelPath);
    const policy = require(policyPath);
    const root = { _id: new mongoose.Types.ObjectId(), role: "super_admin" };
    // The FIRST version is the only in-window one; every later version is
    // future-dated, so resolution must not depend on any newest-N limit.
    const inWindow = await policy.record({ ...TAX_POLICY, decisionReference: "TEST-WINDOW-0" }, root);
    assert.equal(inWindow.version, 1);
    for (let i = 0; i < 104; i += 1) {
      await policy.record(
        { ...TAX_POLICY, decisionReference: "TEST-WINDOW-" + (i + 1), effectiveFrom: new Date(Date.now() + 86400000) },
        root,
      );
    }
    assert.equal(await Policy.countDocuments(), 105);
    const resolved = await policy.active("tax");
    assert.ok(resolved, "the in-window version resolves despite 104 newer versions");
    assert.equal(String(resolved._id), String(inWindow._id));
    assert.equal(resolved.version, 1);
  },
);
