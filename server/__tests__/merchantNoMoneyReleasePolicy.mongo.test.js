"use strict";
// Zero-only no-money release POLICY AUTHORITY (workstream Z) — immutable,
// versioned MerchantNoMoneyReleasePolicy records. Mechanism, not policy:
// recording is super_admin-only + audited; content is operator input with no
// defaults; production databases hold zero records. Resolution (`activePolicy`)
// is read-only and returns null when no recorded in-window version exists —
// the fail-closed default for the release executor.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const modelPath = path.resolve(
    __dirname,
    "../models/MerchantNoMoneyReleasePolicy.js",
  ),
  authorityPath = path.resolve(
    __dirname,
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/policy.js",
  ),
  routePath = path.resolve(
    __dirname,
    "../routes/merchantNoMoneyReleasePolicy.routes.js",
  );
const Policy = require(modelPath);
const authority = require(authorityPath);

const POLICY = {
  tenant: "000000000000000000000001",
  version: 1,
  recordShape: "zero_release_v1",
  scopeRule: "zero_merchandise_only",
  auditWording:
    "Approved no-money release: zero-value units only; explicit no-money record, no provider transaction.",
  decisionReference: "TEST-NO-MONEY-1",
};

test(
  "no-money release policy authority records immutable versioned policies, super_admin-only, audited, resolving active fail-closed",
  { skip: !uri },
  async (t) => {
    assert.ok(require("node:fs").existsSync(modelPath), "policy model exists");
    assert.ok(
      require("node:fs").existsSync(authorityPath),
      "policy authority service exists",
    );
    assert.ok(
      require("node:fs").existsSync(routePath),
      "policy route file exists",
    );
    await connectVenueMongo(t, "no_money_policy");
    const AuditLog = require("../models/AuditLog"),
      User = require("../models/User"),
      oid = () => new mongoose.Types.ObjectId();
    const mongoose = require("mongoose");
    const rootId = oid(),
      merchantId = oid();
    const root = { _id: rootId, role: "super_admin" },
      merchant = { _id: merchantId, role: "tenant_owner", tenant: oid() };
    await User.collection.insertOne({
      _id: rootId,
      role: "super_admin",
      status: "active",
    });

    // 1. Tenant actors are denied recording; nothing is written.
    await assert.rejects(
      () => authority.recordPolicy(POLICY, merchant),
      (error) => error.statusCode === 403,
    );
    assert.equal(await Policy.countDocuments(), 0);
    assert.equal(await AuditLog.countDocuments(), 0);

    // 2. super_admin records version 1; audited; identity + contentHash set.
    const recorded = await authority.recordPolicy(POLICY, root);
    assert.equal(recorded.version, 1);
    assert.equal(recorded.state, "recorded");
    assert.equal(recorded.recordShape, "zero_release_v1");
    assert.equal(recorded.scopeRule, "zero_merchandise_only");
    assert.ok(recorded.contentHash);
    assert.equal(String(recorded.recordedBy), String(rootId));
    assert.equal(String(recorded.tenant), POLICY.tenant);
    assert.equal(await Policy.countDocuments(), 1);
    const audit = await AuditLog.findOne({
      action: "MERCHANT_NO_MONEY_RELEASE_POLICY_RECORDED",
    }).lean();
    assert.ok(audit, "recording is audited");
    assert.equal(audit.actionCategory, "create");
    assert.equal(
      audit.changes.after.policyId,
      recorded._id,
      "audit carries the exact policy identity",
    );

    // 3. Immutable versions: same version conflicts; older version conflicts;
    // every direct mutation of a recorded version is rejected.
    await assert.rejects(
      () =>
        authority.recordPolicy({ ...POLICY, scopeRule: "zero_merchandise_any_shipping_tax" }, root),
      /version already exists/,
    );
    await assert.rejects(
      () => authority.recordPolicy({ ...POLICY, version: 1 }, root),
      /already exists/,
    );
    await assert.rejects(
      () => Policy.updateOne({ version: 1 }, { $set: { scopeRule: "x" } }),
      /immutable/,
    );
    await assert.rejects(
      () =>
        Policy.findOneAndUpdate(
          { version: 1 },
          { $set: { auditWording: "rewritten wording" } },
        ),
      /immutable/,
    );
    await assert.rejects(
      () => Policy.deleteOne({ version: 1 }),
      /immutable/,
    );
    assert.equal(
      (await Policy.findOne({ version: 1 }).lean()).auditWording,
      POLICY.auditWording,
      "recorded wording unchanged",
    );

    // 4. Version sequencing is monotonic per tenant: a skipped version can
    // never be recorded later, and an older version is always rejected.
    const next = await authority.recordPolicy(
      {
        ...POLICY,
        version: 3,
        scopeRule: "zero_merchandise_any_shipping_tax",
        decisionReference: "TEST-NO-MONEY-3",
      },
      root,
    );
    assert.equal(next.version, 3);
    await assert.rejects(
      () => authority.recordPolicy({ ...POLICY, version: 2 }, root),
      /newer immutable version/,
    );
    await assert.rejects(
      () => authority.recordPolicy({ ...POLICY, version: 1 }, root),
      /already exists/,
    );

    // 5. activePolicy resolution is fail-closed: newest recorded in-window
    // version recorded by a current active super_admin; anything else null.
    assert.equal(
      await authority.activePolicy(new mongoose.Types.ObjectId(), null),
      null,
      "unknown tenant has no policy",
    );
    const active = await authority.activePolicy(
      new mongoose.Types.ObjectId(POLICY.tenant),
      null,
    );
    assert.ok(active, "newest recorded version governs");
    assert.equal(active.version, 3);
    // Recorded-by identity missing or inactive → fail closed.
    const orphan = await authority.recordPolicy(
      {
        ...POLICY,
        tenant: "000000000000000000000002",
        version: 1,
        decisionReference: "TEST-NO-MONEY-3",
      },
      root,
    );
    await User.updateOne({ _id: rootId }, { $set: { status: "suspended" } });
    assert.equal(
      await authority.activePolicy(new mongoose.Types.ObjectId(POLICY.tenant), null),
      null,
      "inactive recording super_admin fails closed",
    );
    await User.updateOne({ _id: rootId }, { $set: { status: "active" } });
    await User.collection.updateOne(
      { _id: rootId },
      { $set: { status: "suspended" } },
    );
    assert.equal(
      await authority.activePolicy(new mongoose.Types.ObjectId(POLICY.tenant), null),
      null,
      "collection-level identity check also fails closed",
    );
    await User.collection.updateOne(
      { _id: rootId },
      { $set: { status: "active" } },
    );
    // Effective window outside now → fail closed.
    await authority.recordPolicy(
      {
        ...POLICY,
        tenant: "000000000000000000000003",
        version: 1,
        decisionReference: "TEST-NO-MONEY-4",
        effectiveUntil: new Date(Date.now() - 86400000),
      },
      root,
    );
    assert.equal(
      await authority.activePolicy(new mongoose.Types.ObjectId("000000000000000000000003"), null),
      null,
      "expired recorded version fails closed",
    );
    assert.ok(orphan);
  },
);

test(
  "no-money release policy HTTP surface is super_admin-only with real JWT",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "no_money_policy_http");
    const names = ["JWT_SECRET"],
      before = names.map((key) => process.env[key]);
    process.env.JWT_SECRET = "zero-policy-test-only";
    t.after(() =>
      names.forEach((key, index) =>
        before[index] === undefined
          ? delete process.env[key]
          : (process.env[key] = before[index]),
      ),
    );
    const User = require("../models/User"),
      mongoose = require("mongoose"),
      adminId = new mongoose.Types.ObjectId(),
      ownerId = new mongoose.Types.ObjectId(),
      tenantId = new mongoose.Types.ObjectId();
    await User.collection.insertMany([
      { _id: adminId, role: "super_admin", status: "active" },
      {
        _id: ownerId,
        role: "tenant_owner",
        tenant: tenantId,
        status: "active",
      },
    ]);
    const app = express();
    app.use(express.json());
    app.use(
      "/merchant-no-money-release-policies",
      require(routePath),
    );
    app.use((error, req, res, next) =>
      res.status(error.statusCode || 500).json({ message: error.message }),
    );
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = (actor, body) =>
      fetch(
        `http://127.0.0.1:${server.address().port}/merchant-no-money-release-policies`,
        {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            ...(actor
              ? {
                  Authorization: `Bearer ${jwt.sign(
                    { userId: String(actor._id) },
                    process.env.JWT_SECRET,
                  )}`,
                }
              : {}),
          },
          ...(actor && body ? { body: JSON.stringify(body) } : {}),
        },
      ).then(async (response) => ({
        status: response.status,
        body: await response.json(),
      }));
    const admin = { _id: adminId },
      owner = { _id: ownerId };
    assert.equal((await call(null)).status, 401, "unauthenticated read denied");
    assert.equal(
      (await call(owner, { ...POLICY, tenant: String(tenantId) })).status,
      403,
      "tenant actor denied recording",
    );
    const recorded = await call(admin, { ...POLICY, tenant: String(tenantId) });
    assert.equal(recorded.status, 201, "super_admin records policy");
    assert.equal(recorded.body.data.policy.version, 1);
    assert.equal(
      (await call(admin)).status,
      200,
      "super_admin reads recorded policies",
    );
  },
);
