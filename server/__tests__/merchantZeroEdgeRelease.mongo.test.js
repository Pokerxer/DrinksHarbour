"use strict";
// Zero-only no-money release — scope rules, old-path refusal, tenant isolation
// and the HTTP surface (workstream Z). The recorded scope rule alone decides
// whether shipping/tax components block a zero-value release; the positive
// refund authority remains the only money path; foreign tenants see 404.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose"),
  express = require("express"),
  jwt = require("jsonwebtoken");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const { releaseZeroUnits, VERBATIM, FLAG } = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/release",
  ),
  policyAuthority = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/policy",
  ),
  commands = require("../services/merchantFulfillment/quantity/commands");
const GATES = [
  "MERCHANT_FULFILLMENT_ENABLED",
  "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
  FLAG,
];
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
async function prepare(t, suffix, shippingFee) {
  await connectVenueMongo(t, suffix);
  const User = require("../models/User");
  const rootId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: rootId,
    role: "super_admin",
    status: "active",
  });
  const root = { _id: rootId, role: "super_admin" };
  const { order, actors, tenants } =
    await require("./helpers/merchantZeroReleaseFixture").fixture({ shippingFee });
  const Child = require("../models/MerchantOrder");
  const child = await Child.findOne({ order: order._id, tenant: tenants[0]._id });
  const zeroLine = child.lines.find((line) => line.merchandiseMinor === 0);
  assert.ok(zeroLine, "fixture carries the zero-merchandise line");
  return { child, zeroLine, actors, tenants, root, order };
}

test("scope rules, old-path refusals and foreign-tenant isolation", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors, root } = await prepare(t, "z_edges", 10);
  assert.ok(child.shippingMinor > 0, "shipping component present");
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "Scope test wording: only purely zero-merchandise orders.",
      decisionReference: "TEST-Z-SCOPE-1",
    },
    root,
  );
  // 1. The existing cancellation authority refuses a bare zero-only release.
  await assert.rejects(
    () =>
      commands.cancelQuantities(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 1 }],
          expectedVersion: child.version,
          idempotencyKey: "z-old-cancel",
        },
        actors[0],
      ),
    (error) => error.statusCode === 409,
  );
  assert.equal(
    await require("../models/MerchantQuantityCancellation").countDocuments(),
    0,
  );
  // 2. The zero-only refund request through the money path also refuses.
  await assert.rejects(
    () =>
      require("../services/merchantFulfillment/quantity/refunds").request(
        child._id,
        {
          lines: [
            { line: String(zeroLine.line), ranges: [{ start: 0, quantity: 1 }] },
          ],
          expectedVersion: child.version,
          idempotencyKey: "z-zero-refund",
          reason: "Zero-only refund attempt must refuse",
        },
        actors[0],
      ),
    (error) => error.statusCode === 409,
  );
  // 3. zero_merchandise_only blocks a child carrying shipping.
  await assert.rejects(
    () =>
      releaseZeroUnits(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 1 }],
          expectedVersion: child.version,
          idempotencyKey: "z-scope-1",
        },
        actors[0],
      ),
    (error) => error.statusCode === 409 && /scope rule/.test(error.message),
  );
  // 4. zero_merchandise_any_shipping_tax releases; money untouched.
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 2,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_any_shipping_tax",
      auditWording: "Scope v2 wording: zero-value units, no money movement.",
      decisionReference: "TEST-Z-SCOPE-2",
    },
    root,
  );
  const version = (await (require("../models/MerchantOrder")).findById(child._id)).version;
  const record = await releaseZeroUnits(
    child._id,
    {
      lines: [{ line: String(zeroLine.line), quantity: 1 }],
      expectedVersion: version,
      idempotencyKey: "z-scope-2",
    },
    actors[0],
  );
  assert.equal(record.kind, "no_money");
  assert.equal(record.policyVersion, 2);
  const after = await (require("../models/MerchantOrder")).findById(child._id).lean();
  assert.equal(after.shippingMinor, child.shippingMinor);
  assert.equal(after.taxMinor, child.taxMinor);
  // 5. Foreign tenant is isolated (404, no enumeration).
  await assert.rejects(
    () =>
      releaseZeroUnits(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 1 }],
          expectedVersion: 99,
          idempotencyKey: "z-foreign",
        },
        actors[1],
      ),
    (error) => error.statusCode === 404,
  );
});

test("HTTP surface: JWT required, verbatim 409 without policy, gated release, foreign 404", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const secret = "z-http-test-only";
  process.env.JWT_SECRET = secret;
  t.after(() => {
    delete process.env.JWT_SECRET;
  });
  const { child, zeroLine, actors, tenants } = await prepare(t, "z_http", 0);
  const rootId = new mongoose.Types.ObjectId();
  await require("../models/User").collection.insertOne({
    _id: rootId,
    role: "super_admin",
    status: "active",
  });
  const app = express();
  app.use(express.json());
  app.use(
    "/merchant-orders/:id/quantity",
    require("../routes/merchantQuantity.routes"),
  );
  app.use((error, req, res, next) =>
    res.status(error.statusCode || 500).json({ message: error.message }),
  );
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const bearer = (actor) =>
    "Bearer " + jwt.sign({ userId: String(actor._id) }, secret);
  const call = async (actor, body) => {
    const headers = { "Content-Type": "application/json" };
    if (actor) headers.Authorization = bearer(actor);
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/merchant-orders/${child._id}/quantity/zero-release`,
      {
        method: "POST",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  const version = async () =>
    (await (require("../models/MerchantOrder")).findById(child._id)).version;
  const body = async (key) => ({
    lines: [{ line: String(zeroLine.line), quantity: 1 }],
    expectedVersion: await version(),
    idempotencyKey: key,
  });
  assert.equal((await call(null, {})).status, 401, "JWT required");
  const refused = await call(actors[0], await body("z-http-closed"));
  assert.equal(refused.status, 409);
  assert.equal(refused.body.message, VERBATIM);
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "HTTP test wording: zero-value units, no provider transaction.",
      decisionReference: "TEST-Z-HTTP-1",
    },
    { _id: rootId, role: "super_admin" },
  );
  const released = await call(actors[0], await body("z-http-open"));
  assert.equal(released.status, 200);
  assert.equal(released.body.data.release.kind, "no_money");
  assert.equal(released.body.data.release.providerTransaction, "none");
  const foreign = await call(actors[1], await body("z-http-foreign"));
  assert.equal(foreign.status, 404);
  assert.equal(
    await require("../models/MerchantNoMoneyRelease").countDocuments({
      tenant: tenants[1]._id,
    }),
    0,
  );
});

test("old-path refusals isolate the zero-only reason on a shipping-0 child with an allocated original receipt", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors, root, order } = await prepare(t, "z_zeroonly", 0);
  assert.equal(child.shippingMinor, 0, "shipping-0 variant");
  assert.equal(child.taxMinor, 0);
  // SF-1 reason isolation: build the FULL original refund authority (allocated
  // stripe platform claim + posted settlement journal + active accounts) so the
  // money path's receipt/journal gates pass and any 409 below can only be the
  // ZERO-ONLY gate itself — never a missing-receipt artifact.
  const parent = await require("../models/Order").findById(order._id).lean();
  await require("../services/chartOfAccounts.service").ensureDefaultCOA(child.tenant);
  await require("../services/journalEntry.service").postJournalEntry({
    tenantId: child.tenant,
    refDoc: parent._id,
    entryType: "sales_revenue",
    source: "marketplace",
    lines: [
      { account: "1300", debit: 24 },
      { account: "6500", debit: 6 },
      { account: "4000", credit: 30 },
    ],
  });
  await require("../models/MarketplacePaymentClaim").create({
    _id: "stripe:platform:pi_zero_only_release_z",
    provider: "stripe",
    account: "platform",
    reference: "pi_zero_only_release_z",
    user: parent.user,
    amount: 50,
    currency: "NGN",
    state: "allocated",
    order: parent._id,
    receipt: {
      method: "stripe",
      reference: "pi_zero_only_release_z",
      amount: 50,
      currency: "NGN",
    },
  });
  // 1. Old quantity cancellation refuses: a zero-only unit can never carry a
  // refunded financial block, so the refunded-block authority leaves nothing
  // cancellable — the zero-only reason with its exact wording, not a
  // shipping/tax gate (shipping and tax are both 0 here).
  await assert.rejects(
    () =>
      commands.cancelQuantities(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 1 }],
          expectedVersion: child.version,
          idempotencyKey: "z-zeroonly-cancel",
        },
        actors[0],
      ),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Quantity exceeds remaining owned units",
  );
  assert.equal(
    await require("../models/MerchantQuantityCancellation").countDocuments(),
    0,
  );
  // 2. The zero-only refund request through the money path refuses on the
  // zero-amount gate itself (the request's exact reconciliation wording) with
  // the receipt and journal authority fully in place.
  await assert.rejects(
    () =>
      require("../services/merchantFulfillment/quantity/refunds").request(
        child._id,
        {
          lines: [
            { line: String(zeroLine.line), ranges: [{ start: 0, quantity: 1 }] },
          ],
          expectedVersion: child.version,
          idempotencyKey: "z-zeroonly-refund",
          reason: "Zero-only units cannot carry a supported money refund",
        },
        actors[0],
      ),
    (error) =>
      error.statusCode === 409 &&
      error.message ===
        "Exact original quantity refund ownership requires reconciliation",
  );
  assert.equal(
    await require("../models/MerchantRefundAllocation").countDocuments(),
    0,
  );
  // N-1: requesting a positive-merchandise unit through the new command is
  // impossible — no zero-value unit run exists for that line → 409, zero writes.
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "Zero-only isolation test wording: zero-value units only.",
      decisionReference: "TEST-Z-ZEROONLY-1",
    },
    root,
  );
  const positiveLine = child.lines.find((line) => line.merchandiseMinor > 0);
  await assert.rejects(
    () =>
      releaseZeroUnits(
        child._id,
        {
          lines: [
            { line: String(positiveLine.line), quantity: 1 },
          ],
          expectedVersion: child.version,
          idempotencyKey: "z-positive-through-zero",
        },
        actors[0],
      ),
    (error) =>
      error.statusCode === 409 &&
      error.message ===
        "Zero-value release requires the requested quantity of unallocated zero-merchandise units",
  );
  assert.equal(
    await require("../models/MerchantNoMoneyRelease").countDocuments(),
    0,
  );
});
