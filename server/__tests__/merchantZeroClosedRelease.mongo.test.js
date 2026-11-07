"use strict";
// Zero-only no-money RELEASE executor — fail-closed gates (workstream Z):
// without a recorded policy, with the flag off, or against an unsupported
// recorded shape, the release is refused with the verbatim readiness wording
// and ZERO writes (no hold mutation, no record, no operation key, no audit).
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const { releaseZeroUnits, VERBATIM, FLAG } = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/release",
  ),
  policyAuthority = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/policy",
  );
const GATES = [
  "MERCHANT_FULFILLMENT_ENABLED",
  "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
];
// N-2: the fixture carries TWO holds per child (positive + zero line), so the
// zero-write proof snapshots every hold keyed by id — genuinely per-hold.
const perHold = (rows) =>
  Object.fromEntries(rows.map((row) => [String(row._id), row]));
function gates(t, keys) {
  const before = keys.map((key) => process.env[key]);
  for (const key of keys) process.env[key] = "true";
  t.after(() =>
    keys.forEach((key, index) =>
      before[index] === undefined
        ? delete process.env[key]
        : (process.env[key] = before[index]),
    ),
  );
}

test("zero-only release fails closed with zero writes", { skip: !uri }, async (t) => {
  gates(t, GATES);
  await connectVenueMongo(t, "zero_closed");
  const User = require("../models/User");
  const rootId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: rootId,
    role: "super_admin",
    status: "active",
  });
  const root = { _id: rootId, role: "super_admin" };
  const { order, actors, tenants } =
    await require("./helpers/merchantZeroReleaseFixture").fixture();
  const Child = require("../models/MerchantOrder");
  await require("../services/merchantFulfillment/actions").act(
    (await Child.findOne({ order: order._id, tenant: tenants[0]._id }).lean())
      ._id,
    { action: "accept", expectedVersion: 1, idempotencyKey: "z-accept-a" },
    actors[0],
  );
  const child = await Child.findOne({ order: order._id, tenant: tenants[0]._id });
  const zeroLine = child.lines.find((line) => line.merchandiseMinor === 0);
  assert.ok(zeroLine, "fixture carries a zero-merchandise line");
  const input = {
    lines: [{ line: String(zeroLine.line), quantity: 2 }],
    expectedVersion: child.version,
    idempotencyKey: "z-closed-1",
  };
  const Hold = require("../models/OnlineStockReservation"),
    Release = require("../models/MerchantNoMoneyRelease"),
    Operation = require("../models/MerchantFulfillmentOperation");
  const before = {
    holds: perHold(await Hold.find({ merchantOrder: child._id }).lean()),
    releases: await Release.countDocuments(),
    operations: await Operation.countDocuments(),
    audits: await require("../models/AuditLog").countDocuments({
      action: "MERCHANT_ZERO_ONLY_RELEASE",
    }),
    childVersion: child.version,
  };
  // 1. No recorded policy → verbatim readiness wording.
  await assert.rejects(
    () => releaseZeroUnits(child._id, input, actors[0]),
    (error) => error.statusCode === 409 && error.message === VERBATIM,
  );
  // 2. Policy recorded but release flag off → verbatim readiness wording.
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "Test no-money release wording: zero-value units only.",
      decisionReference: "TEST-Z-CLOSED-1",
    },
    root,
  );
  assert.equal(await require("../models/MerchantNoMoneyReleasePolicy").countDocuments(), 1);
  await assert.rejects(
    () => releaseZeroUnits(child._id, input, actors[0]),
    (error) => error.message === VERBATIM,
  );
  // 3. Recorded shape the mechanism does not support (bypassed schema row).
  process.env[FLAG] = "true";
  await require("../models/MerchantNoMoneyReleasePolicy").collection.insertOne({
    _id: "unsupported_shape_record_z",
    tenant: child.tenant,
    version: 2,
    state: "recorded",
    recordShape: "future_shape_v9",
    scopeRule: "zero_merchandise_only",
    auditWording: "Future policy wording this mechanism cannot execute.",
    recordedBy: rootId,
    recordedAt: new Date(),
    contentHash: "0".repeat(64),
  });
  await assert.rejects(
    () => releaseZeroUnits(child._id, input, actors[0]),
    (error) => /does not support/.test(error.message),
  );
  delete process.env[FLAG];
  // Zero writes: hold byte-identical, no records, no keys consumed, no audit.
  const after = {
    holds: perHold(await Hold.find({ merchantOrder: child._id }).lean()),
    releases: await Release.countDocuments(),
    operations: await Operation.countDocuments(),
    audits: await require("../models/AuditLog").countDocuments({
      action: "MERCHANT_ZERO_ONLY_RELEASE",
    }),
    childVersion: (await Child.findById(child._id)).version,
  };
  assert.equal(
    Object.keys(after.holds).length,
    2,
    "fixture carries two holds per child",
  );
  assert.deepEqual(after.holds, before.holds, "every hold byte-identical");
  assert.equal(after.releases, before.releases);
  assert.equal(after.operations, before.operations);
  assert.equal(after.audits, before.audits);
  assert.equal(after.childVersion, before.childVersion);
});
