"use strict";
// Platform-ops policy registry — real replica regression. (1) With ZERO
// recorded policy rows every mechanism projects its fail-closed empty state
// with the mechanism's own verbatim wording, default-off flags and no policy
// content/credential leak; double reads are JSON-identical zero-write reads.
// (2) Role denial: the registry read is super_admin-only because every
// authority's documented list() read path is super_admin-asserted.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { connectVenueMongo } = require("./helpers/venueMongo");

const NOTICE = "Readiness evidence is not activation permission.";
// Verbatim recorded mechanism wordings (test copies; the projection below
// surfaces them live and the assertion anchors the exact strings).
const TENDER = "Original tender refund capability requires review.";
const PAYOUT = "No payout execution exists; payout policy requires review.";
const FEE_NOTE =
  "No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.";
const FEE_NOT_RECORDED =
  "Provider fee bearer, future-fee treatment and historical-fee rule for this flow are not recorded; fee treatment authority fails closed until a super admin records a version.";
const SHIPPING =
  "Original shipping refund and carrier-charge allocation policy requires review.";
const TAX = "Original tax refund and journal allocation policy requires review.";
const ZERO =
  "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.";
const RETURN_EFFECTS =
  "Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported";
const REGISTRY_GATE =
  "Platform operations policy registry requires a platform super admin.";
const OMITTED_MECHANISMS = [
  "kora_refund",
  "payout_transfer",
  "fee_treatment",
  "return_disposition",
  "shipping_refund_allocation",
  "tax_component_refund",
  "discount_component_refund",
  "zero_only_release",
  "stored_value_wallet_refund",
  "stored_value_gift_card_refund",
];
const BASIS_WORDING = {
  kora_refund: TENDER,
  payout_transfer: PAYOUT,
  fee_treatment: FEE_NOTE,
  return_disposition: RETURN_EFFECTS,
  shipping_refund_allocation: SHIPPING,
  tax_component_refund: TAX,
  discount_component_refund: TENDER,
  zero_only_release: ZERO,
  stored_value_wallet_refund: TENDER,
  stored_value_gift_card_refund: TENDER,
};

async function mount(t) {
  const express = require("express"),
    jwt = require("jsonwebtoken");
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "synthetic-platform-ops-registry";
  t.after(() =>
    previous === undefined
      ? delete process.env.JWT_SECRET
      : (process.env.JWT_SECRET = previous)
  );
  const app = express();
  app.use(express.json());
  app.use("/platform-ops", require("../routes/platformOps.routes"));
  app.use((err, req, res, next) =>
    res.status(err.statusCode || 500).json({ message: err.message })
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = (who) =>
    jwt.sign({ userId: String(who._id) }, process.env.JWT_SECRET);
  const call = async (who, method, path) => {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/platform-ops${path}`,
      { method, headers: { Authorization: `Bearer ${token(who)}` } }
    );
    const text = await r.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
    return { status: r.status, body: parsed };
  };
  return { call };
}

async function users(...roles) {
  const User = require("../models/User");
  const rows = roles.map((role) => ({
    _id: new mongoose.Types.ObjectId(),
    email: `${role}@example.test`,
    role,
    status: "active",
  }));
  await User.collection.insertMany(rows);
  return Object.fromEntries(rows.map((row) => [row.role, row]));
}

test("registry projects every mechanism fail-closed with zero records, verbatim wording and no content leak", async (t) => {
  await connectVenueMongo(t, "ops_registry");
  const people = await users("super_admin", "admin", "tenant_owner", "customer");
  const { call } = await mount(t);
  const first = await call(people.super_admin, "GET", "/policy-registry");
  assert.equal(first.status, 200);
  const registry = first.body.data;
  assert.equal(registry.registryVersion, 1);
  assert.equal(registry.notice, NOTICE);
  assert.deepEqual(
    registry.mechanisms.map((row) => row.mechanism),
    OMITTED_MECHANISMS.concat(),
  );
  const byName = new Map(registry.mechanisms.map((row) => [row.mechanism, row]));
  for (const name of OMITTED_MECHANISMS) {
    const entry = byName.get(name);
    assert.equal(entry.flag.enabled, false, `${name} flag must be state-only off`);
    assert.equal(entry.policy.state, "none_recorded", `${name} must be none_recorded`);
    assert.equal(entry.policy.recordedVersions, 0);
    assert.deepEqual(entry.policy.versions, []);
    assert.equal(entry.policy.activeVersion, null);
    assert.equal(entry.reason, BASIS_WORDING[name]);
    assert.equal(entry.readOnly, true);
    assert.equal(entry.failureState, "none_recorded_all_surfaces_fail_closed");
  }
  // The fee-treatment entry embeds the projection's six flows fail-closed.
  const feeFlows = byName.get("fee_treatment").feeFlows;
  assert.equal(feeFlows.length, 6);
  for (const flow of feeFlows) {
    assert.equal(flow.state, "not_recorded");
    assert.equal(flow.bearer, null);
    assert.equal(flow.policyVersion, null);
    assert.equal(flow.reason, FEE_NOT_RECORDED);
  }
  // No recorded contract content, hash, account or credential material.
  const leakText = JSON.stringify(registry);
  for (const secret of [
    "endpointsShapeReference",
    "contentHash",
    "scheduleRule",
    "auditWording",
    "treatmentByCondition",
    "accountRefer",
  ])
    assert.equal(leakText.includes(secret), false, `must not leak ${secret}`);

  // Zero-write idempotency: double read JSON-identical, no writes.
  const second = await call(people.super_admin, "GET", "/policy-registry");
  assert.equal(JSON.stringify(second.body.data), JSON.stringify(registry));
  const policyModels = [
    require("../models/MerchantKoraRefundPolicy"),
    require("../models/MerchantPayoutPolicy"),
    require("../models/MerchantFeeTreatmentPolicy"),
    require("../models/MerchantDispositionPolicy"),
    require("../models/MerchantShippingRefundPolicy"),
    require("../models/MerchantComponentRefundPolicy"),
    require("../models/MerchantNoMoneyReleasePolicy"),
    require("../models/StoredValueRefundPolicy"),
  ];
  const counts = await Promise.all(policyModels.map((m) => m.countDocuments({})));
  assert.deepEqual(counts, [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal((await require("../models/AuditLog").countDocuments({})), 0);
});

test("registry read is super_admin-only at route and service level", async (t) => {
  await connectVenueMongo(t, "ops_registry_roles");
  const people = await users("super_admin", "admin", "tenant_owner", "customer");
  const { call } = await mount(t);
  const registry = require("../services/operations/policyRegistry");
  for (const [role, message] of [
    ["admin", REGISTRY_GATE],
    ["tenant_owner", REGISTRY_GATE],
    ["customer", REGISTRY_GATE],
  ]) {
    const response = await call(people[role], "GET", "/policy-registry");
    assert.equal(response.status, 403, `${role} must be denied`);
    // The authorize middleware fires first with its own wording (which may
    // cite either the router-level super_admin/admin gate or the route-level
    // super_admin gate); the service-level gate carries the registry wording
    // (pinned separately below).
    assert.ok(
      response.body.message === REGISTRY_GATE ||
        /Access denied/.test(String(response.body.message)),
      `unexpected denial message: ${response.body.message}`
    );
    await assert.rejects(
      registry.snapshot({ role, _id: people[role]._id }),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, message);
        return true;
      }
    );
  }
});
