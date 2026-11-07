"use strict";
// Stored-value refund POLICY AUTHORITY — immutable, versioned destination-policy
// records. Mechanism, not policy: the recording endpoint stores operator input
// verbatim (destination = original object only; expiry/precision are recorded
// fields with no defaults). Production contains no records; tests create
// explicitly synthetic ones.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(
  __dirname,
  "../models/StoredValueRefundPolicy.js",
);
const authorityPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/refundSources/policyAuthority.js",
);
const routePath = path.resolve(
  __dirname,
  "../routes/storedValueRefundPolicy.routes.js",
);
const StoredValueRefundPolicy = require(modelPath);
const authority = require(authorityPath);

const GIFT_POLICY = {
  kind: "gift_card",
  destination: "original_object",
  amountPrecisionRule: "whole_naira_units",
  giftExpiryRule: "reject_if_expired",
  decisionReference: "TEST-DECISION-1",
};

test(
  "stored-value refund policy authority records immutable versioned destination policies, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(
      require("node:fs").existsSync(modelPath),
      "StoredValueRefundPolicy model exists",
    );
    assert.ok(
      require("node:fs").existsSync(authorityPath),
      "policyAuthority service exists",
    );
    assert.ok(
      require("node:fs").existsSync(routePath),
      "stored-value refund policy route exists",
    );
    await connectVenueMongo(t, "stored_value_policy_authority");
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const rootId = oid(),
      tenantOwnerId = oid();
    const root = { _id: rootId, role: "super_admin" };
    const merchant = {
      _id: tenantOwnerId,
      role: "tenant_owner",
      tenant: oid(),
    };

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(
      () => authority.record(GIFT_POLICY, merchant),
      /super admin/i,
    );
    assert.equal(await StoredValueRefundPolicy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Destination substitution is structurally rejected — the mechanism
    //    binds the original stored-value object only.
    await assert.rejects(
      () =>
        authority.record(
          { ...GIFT_POLICY, destination: "customer_bank_account" },
          root,
        ),
      /original/i,
    );
    assert.equal(await StoredValueRefundPolicy.countDocuments(), 0);

    // 3. A super_admin records version 1; the record is audited.
    const v1 = await authority.record(GIFT_POLICY, root);
    assert.equal(v1.kind, "gift_card");
    assert.equal(v1.destination, "original_object");
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.equal(String(v1.recordedBy), String(rootId));
    assert.ok(v1.recordedAt);
    assert.ok(v1.contentHash);
    const audit = await AuditLog.findOne({
      action: "STORED_VALUE_REFUND_POLICY_RECORD",
    }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(String(audit.actorUserId), String(rootId));
    assert.equal(audit.actorRole, "super_admin");

    // 4. Recorded policies are immutable: any update or delete of an existing
    //    version is rejected; a new commercial decision is a new version.
    await assert.rejects(
      () =>
        StoredValueRefundPolicy.updateOne(
          { _id: v1._id },
          { $set: { giftExpiryRule: "reactivate_expired_card" } },
        ),
      /immutable/i,
    );
    await assert.rejects(
      () => StoredValueRefundPolicy.deleteOne({ _id: v1._id }),
      /immutable/i,
    );
    const unchanged = await StoredValueRefundPolicy.findById(v1._id).lean();
    assert.equal(unchanged.giftExpiryRule, "reject_if_expired");

    // 5. Version collisions are rejected; version 2 records cleanly and
    //    becomes the active policy for its kind.
    await assert.rejects(
      () => authority.record({ ...GIFT_POLICY, version: 1 }, root),
      /version/i,
    );
    const v2 = await authority.record(
      {
        ...GIFT_POLICY,
        giftExpiryRule: "reactivate_expired_card",
        decisionReference: "TEST-DECISION-2",
      },
      root,
    );
    assert.equal(v2.version, 2);
    const active = await authority.active("gift_card");
    assert.equal(String(active._id), String(v2._id));

    // 6. Wallet policies must not carry gift rules; the recorded precision
    //    rule is the only executable one.
    const wallet = await authority.record(
      {
        kind: "wallet",
        destination: "original_object",
        amountPrecisionRule: "whole_naira_units",
        decisionReference: "TEST-DECISION-3",
      },
      root,
    );
    assert.equal(wallet.version, 1);
    assert.equal(wallet.giftExpiryRule, undefined);
    await assert.rejects(
      () =>
        authority.record(
          { ...GIFT_POLICY, giftExpiryRule: undefined, version: 3 },
          root,
        ),
      /gift/i,
    );
    await assert.rejects(
      () =>
        authority.record(
          {
            kind: "wallet",
            destination: "original_object",
            amountPrecisionRule: "round_to_nearest_kobo",
          },
          root,
        ),
      /precision/i,
    );

    // 7. active() is fail-closed: unknown kind → null; outside the recorded
    //    effective window → null.
    assert.equal(await authority.active("unknown_tender"), null);
    await authority.record(
      {
        ...GIFT_POLICY,
        version: 3,
        effectiveFrom: new Date(Date.now() + 86400000),
      },
      root,
    );
    const windowed = await authority.active("gift_card");
    assert.equal(String(windowed._id), String(v2._id));
  },
);

test(
  "recording endpoint is super_admin-only over real JWT and audits recorded versions",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "stored_value_policy_route");
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
    process.env.JWT_SECRET = "stored-value-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/stored-value-refund-policies", require(routePath));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/stored-value-refund-policies`,
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
    assert.equal((await call({ _id: merchantId }, GIFT_POLICY)).status, 403);
    assert.equal(await StoredValueRefundPolicy.countDocuments(), 0);

    // Super admin records through the endpoint; the version is listed back.
    const reply = await call({ _id: rootId }, GIFT_POLICY);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.data.policy.version, 1);
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
    assert.equal(list.body.data.policies[0].kind, "gift_card");
  },
);
