"use strict";
// Kora refund POLICY AUTHORITY (workstream K) — immutable versioned
// protocol/identity policy records. Mechanism, not policy: the recording
// endpoint stores operator input verbatim (the reviewed protocol facts ARE the
// fields) and offers no defaults. Production contains no records; tests create
// explicitly synthetic ones. The real Korapay protocol review and the fallback
// identity decision remain external evidence recorded later through these fields.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { recordPolicy } = require("./helpers/koraRefundFixture");

const modelPath = require.resolve("../models/MerchantKoraRefundPolicy.js");
const authorityPath = require.resolve(
  "../services/merchantFulfillment/koraRefund/policy.js",
);
const routePath = require.resolve(
  "../routes/merchantKoraRefundPolicy.routes.js",
);
const MerchantKoraRefundPolicy = require(modelPath);
const authority = require(authorityPath);

const POLICY = {
  endpointsShapeReference:
    "SYNTHETIC reviewed Korapay refund endpoints shape: POST /v1/transactions/:reference/refund with authenticated retrieval by saved refund id (test-only recording; no real endpoint was reviewed or called).",
  authMode: "SYNTHETIC bearer-token mode recorded verbatim; no credential exists or is stored.",
  refundRequestContract:
    "SYNTHETIC request contract: explicit minor NGN amount against the original payment reference with a transport-level idempotency key.",
  refundResponseContract:
    "SYNTHETIC response contract: created refund returns a provider refund id; retrieval by the saved id only.",
  uncertaintyBehavior:
    "SYNTHETIC uncertainty rule: unknown or late outcomes leave the allocation reserved-uncertain; only authenticated retrieval by the saved id settles it.",
  idempotencyConvention:
    "SYNTHETIC idempotency convention: one refund request per command key; replays never re-submit.",
  acceptFallbackTransactionId: false,
  refundFeeBearer: "platform_bears",
  decisionReference: "TEST-K-DECISION-1",
};

test(
  "kora refund policy authority records immutable versioned protocol contracts, super_admin-only, audited",
  { skip: !uri },
  async (t) => {
    assert.ok(require("node:fs").existsSync(modelPath), "MerchantKoraRefundPolicy model exists");
    assert.ok(require("node:fs").existsSync(authorityPath), "koraRefund policy authority exists");
    assert.ok(require("node:fs").existsSync(routePath), "kora refund policy route exists");
    await connectVenueMongo(t, "kora_policy_authority");
    const AuditLog = require("../models/AuditLog");
    const oid = () => new mongoose.Types.ObjectId();
    const rootId = oid();
    const root = { _id: rootId, role: "super_admin" };
    const merchant = { _id: oid(), role: "tenant_owner", tenant: oid() };

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(() => authority.record(POLICY, merchant), /super admin/i);
    assert.equal(await MerchantKoraRefundPolicy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. Recorded protocol facts are validated structurally; nothing is
    //    defaulted — each reviewed fact must be recorded verbatim.
    for (const field of [
      "endpointsShapeReference",
      "authMode",
      "refundRequestContract",
      "refundResponseContract",
      "uncertaintyBehavior",
      "idempotencyConvention",
    ]) {
      await assert.rejects(
        () => authority.record({ ...POLICY, [field]: undefined }, root),
        new RegExp(field, "i"),
      );
    }
    // The identity decision must be recorded as an explicit boolean.
    await assert.rejects(
      () => authority.record({ ...POLICY, acceptFallbackTransactionId: undefined }, root),
      /acceptFallbackTransactionId/i,
    );
    // The bearer vocabulary is shared with the fee-treatment authority (read-import).
    await assert.rejects(
      () => authority.record({ ...POLICY, refundFeeBearer: "customer_gets_a_bonus" }, root),
      /bearer/i,
    );
    assert.equal(await MerchantKoraRefundPolicy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 3. A super_admin records version 1; the record is audited.
    const v1 = await authority.record(POLICY, root);
    assert.equal(v1.version, 1);
    assert.equal(v1.state, "recorded");
    assert.equal(v1.acceptFallbackTransactionId, false);
    assert.equal(v1.refundFeeBearer, "platform_bears");
    assert.equal(String(v1.recordedBy), String(rootId));
    assert.ok(v1.recordedAt);
    assert.ok(typeof v1.contentHash === "string" && v1.contentHash.length === 64);
    const audit = await AuditLog.findOne({ action: "MERCHANT_KORA_REFUND_POLICY_RECORD" }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(String(audit.actorUserId), String(rootId));
    assert.equal(audit.actorRole, "super_admin");
    assert.equal(audit.actionCategory, "create");

    // 4. Recorded versions are immutable: update/delete rejected; a new
    //    commercial decision is a new version, never a rewrite.
    await assert.rejects(
      () => MerchantKoraRefundPolicy.updateOne({ _id: v1._id }, { $set: { acceptFallbackTransactionId: true } }),
      /immutable/i,
    );
    await assert.rejects(() => MerchantKoraRefundPolicy.deleteOne({ _id: v1._id }), /immutable/i);
    const unchanged = await MerchantKoraRefundPolicy.findById(v1._id).lean();
    assert.equal(unchanged.acceptFallbackTransactionId, false);
    assert.equal(unchanged.refundFeeBearer, "platform_bears");

    // 5. Version collision rejected; v2 (reversed identity decision) activates.
    await assert.rejects(() => authority.record({ ...POLICY, version: 1 }, root), /version/i);
    const v2 = await authority.record(
      {
        ...POLICY,
        acceptFallbackTransactionId: true,
        refundFeeBearer: "merchant_bears",
        decisionReference: "TEST-K-DECISION-2",
      },
      root,
    );
    assert.equal(v2.version, 2);
    const active = await authority.active();
    assert.equal(String(active._id), String(v2._id));
    assert.equal(active.acceptFallbackTransactionId, true);

    // 6. active() is fail-closed: outside the recorded effective window the
    //    version is skipped (the newest in-window version governs).
    await authority.record({ ...POLICY, version: 3, effectiveFrom: new Date(Date.now() + 86400000) }, root);
    assert.equal(String((await authority.active())._id), String(v2._id));
    const futureNow = new Date(Date.now() + 90000000);
    assert.equal((await authority.active({ now: futureNow })).decisionReference, "TEST-K-DECISION-1");
  },
);

test(
  "recording endpoint is super_admin-only over real JWT and lists recorded versions",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "kora_policy_route");
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      User = require("../models/User");
    const rootId = new mongoose.Types.ObjectId(),
      merchantId = new mongoose.Types.ObjectId();
    await User.collection.insertMany([
      { _id: rootId, role: "super_admin", status: "active" },
      { _id: merchantId, role: "tenant_owner", status: "active", tenant: new mongoose.Types.ObjectId() },
    ]);
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "kora-policy-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-kora-refund-policies", require(routePath));
    app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ message: e.message }));
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-kora-refund-policies`,
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
    assert.equal((await call({ _id: merchantId }, POLICY)).status, 403);
    assert.equal(await MerchantKoraRefundPolicy.countDocuments(), 0);

    // Super admin records through the endpoint; the version is listed back.
    const reply = await call({ _id: rootId }, POLICY);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.data.policy.version, 1);
    assert.equal(reply.body.data.policy.acceptFallbackTransactionId, false);
    const list = await call({ _id: rootId });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.policies.length, 1);
    assert.equal(list.body.data.policies[0].endpointsShapeReference, POLICY.endpointsShapeReference);
  },
);
