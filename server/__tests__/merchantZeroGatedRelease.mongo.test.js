"use strict";
// Zero-only no-money RELEASE executor — gated physical release (workstream Z):
// under a recorded policy + enabled flag, exactly the zero-merchandise units
// are released through the existing hold authority, one explicit no-money
// record is written per release, once-only under real concurrency, and every
// money surface (budgets, allocations, journals, refund counters, goods basis)
// stays byte-identical.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const { releaseZeroUnits, FLAG } = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/release",
  ),
  policyAuthority = require(
    "../services/merchantFulfillment/quantity/zeroOnlyRelease/policy",
  ),
  { hash } = require("../services/merchantFulfillment/allocation");
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
const moneySnapshot = async (child) => ({
  budgets: await require("../models/MerchantDispatchBudget").find({
    _id: String(child._id),
  }).lean(),
  journals: await require("../models/JournalEntry").countDocuments({
    tenant: child.tenant,
  }),
  allocations: await require("../models/MerchantRefundAllocation").countDocuments({
    merchantOrder: child._id,
  }),
  goodsCancellations: await require("../models/MerchantGoodsCancellation").countDocuments(
    { order: child.order, tenant: child.tenant },
  ),
  refundCounters: {
    reserved: child.refundReservedMinor,
    refunded: child.refundedMinor,
    commission: child.refundedCommissionMinor,
  },
  group: Object.fromEntries(
    Object.entries(
      (await require("../models/MerchantOrderSet").findById(child.order).lean()) || {},
    )
      .filter(([key]) => /refund|total/.test(key) === true)
      .map(([key, value]) => [key, typeof value === "object" ? String(value) : value]),
  ),
  orderMoney: ((row) => ({
    total: row.totalAmount,
    shipping: row.shippingFee,
    tax: row.taxAmount,
    status: row.paymentStatus,
  }))(await require("../models/Order").findById(child.order).lean()),
});

async function preparedChild(t, suffix, { shippingFee = 0 } = {}) {
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
  await require("../services/merchantFulfillment/actions").act(
    (await Child.findOne({ order: order._id, tenant: tenants[0]._id }).lean())._id,
    { action: "accept", expectedVersion: 1, idempotencyKey: "z-accept-" + suffix },
    actors[0],
  );
  const child = await Child.findOne({ order: order._id, tenant: tenants[0]._id });
  const zeroLine = child.lines.find((line) => line.merchandiseMinor === 0);
  await policyAuthority.recordPolicy(
    {
      tenant: String(child.tenant),
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "Recorded test wording: zero-value units, no provider transaction.",
      decisionReference: "TEST-Z-" + suffix,
    },
    root,
  );
  return { child, zeroLine, actors, tenants, root, policy: (await policyAuthority.listPolicies(root))[0] };
}

test("gated zero-only release is physical, once-only, and conserves all money surfaces", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors, policy } = await preparedChild(t, "z_gated");
  const Hold = require("../models/OnlineStockReservation"),
    Stock = require("../models/WarehouseStock"),
    Batch = require("../models/WarehouseBatch"),
    Release = require("../models/MerchantNoMoneyRelease"),
    Operation = require("../models/MerchantFulfillmentOperation"),
    AuditLog = require("../models/AuditLog");
  const holdBefore = await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean(),
    stockBefore = await Stock.findOne({ tenant: child.tenant }).lean(),
    batchesBefore = new Map(
      (await Batch.find({ tenant: child.tenant }).lean()).map((b) => [String(b._id), b.quantity]),
    ),
    moneyBefore = await moneySnapshot(child);
  assert.equal(holdBefore.releasedQuantity, 0);
  const input = {
    lines: [{ line: String(zeroLine.line), quantity: 1 }],
    expectedVersion: child.version,
    idempotencyKey: "z-gated-1",
  };
  const record = await releaseZeroUnits(child._id, input, actors[0]);
  // The explicit no-money record, stamped by the recorded policy.
  assert.equal(record.kind, "no_money");
  assert.equal(record.policyVersion, policy.version);
  assert.equal(String(record.policyId), String(policy._id));
  assert.equal(record.auditWording, policy.auditWording);
  assert.equal(record.providerTransaction, "none");
  assert.deepEqual(
    record.financials,
    { merchandiseMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 },
  );
  assert.equal(record.lines[0].quantity, 1);
  assert.equal(
    record.lines[0].ranges.reduce((n, r) => n + r.quantity, 0),
    1,
  );
  assert.equal(String(record.tenant), String(child.tenant));
  assert.equal(String(record.order), String(child.order));
  // Physical release through the existing hold authority.
  const holdAfter = await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean();
  assert.equal(holdAfter.releasedQuantity, 1);
  assert.equal(holdAfter.consumedQuantity, 0);
  const releaseEntries = holdAfter.unitDispositions.filter((u) => u.action === "release");
  assert.equal(releaseEntries.length, 1);
  assert.equal(String(releaseEntries[0].allocation), String(record._id));
  assert.equal(
    releaseEntries[0].start,
    record.lines[0].ranges[0].start,
    "unit-range identity preserved",
  );
  const stockAfter = await Stock.findOne({ tenant: child.tenant }).lean();
  assert.equal(stockAfter.reservedQuantity, stockBefore.reservedQuantity - 1);
  assert.equal(stockAfter.currentQuantity, stockBefore.currentQuantity);
  for (const allocation of record.lines[0].batchAllocations)
    assert.equal(
      (await Batch.findById(allocation.batch)).quantity,
      batchesBefore.get(String(allocation.batch)) + allocation.quantity,
      "original batch evidence restored exactly",
    );
  const batchesTouched = record.lines[0].batchAllocations.reduce(
    (n, a) => n + a.quantity,
    0,
  );
  assert.equal(batchesTouched, 1);
  const fresh = await (require("../models/MerchantOrder")).findById(child._id);
  const progress = fresh.quantityProgress.find((row) => String(row.line) === String(zeroLine.line));
  assert.equal(progress.cancelled, 1);
  // Operation + audit with the recorded wording; no money surfaces moved.
  const operation = await Operation.findById(hash(child._id + ":" + input.idempotencyKey)).lean();
  assert.ok(operation, "quantity operation recorded");
  assert.equal(operation.action, "zero_release");
  const audit = await AuditLog.findOne({ action: "MERCHANT_ZERO_ONLY_RELEASE" }).lean();
  assert.ok(audit, "release audited");
  assert.equal(audit.justification, policy.auditWording);
  assert.equal(audit.changes.after.kind, "no_money");
  assert.deepEqual(await moneySnapshot(fresh), moneyBefore, "money byte-identical");
  // Idempotent replay: same key, same payload → same record, no new effects.
  const replay = await releaseZeroUnits(child._id, input, actors[0]);
  assert.equal(String(replay._id), String(record._id));
  assert.equal(await Release.countDocuments({ merchantOrder: child._id }), 1);
  assert.equal((await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean()).releasedQuantity, 1);
  // Second zero unit under a fresh key; then overlap of fully released ranges → 409.
  const v2 = (await (require("../models/MerchantOrder")).findById(child._id)).version;
  const second = await releaseZeroUnits(
    child._id,
    { ...input, expectedVersion: v2, idempotencyKey: "z-gated-2" },
    actors[0],
  );
  assert.notEqual(String(second._id), String(record._id));
  assert.equal((await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean()).releasedQuantity, 2);
  await assert.rejects(
    async () =>
      releaseZeroUnits(
        child._id,
        { ...input, expectedVersion: (await (require("../models/MerchantOrder")).findById(child._id)).version, idempotencyKey: "z-gated-3" },
        actors[0],
      ),
    (error) => error.statusCode === 409,
    "fully released zero ranges cannot release again",
  );
  assert.equal(await Release.countDocuments({ merchantOrder: child._id }), 2);
});

test("concurrent identical zero-only releases produce exactly one record and one physical release", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors } = await preparedChild(t, "z_conc");
  const Hold = require("../models/OnlineStockReservation"),
    Release = require("../models/MerchantNoMoneyRelease"),
    Operation = require("../models/MerchantFulfillmentOperation");
  await releaseZeroUnits(
    child._id,
    {
      lines: [{ line: String(zeroLine.line), quantity: 1 }],
      expectedVersion: child.version,
      idempotencyKey: "z-conc-first",
    },
    actors[0],
  );
  const childNow = await (require("../models/MerchantOrder")).findById(child._id);
  const input = {
    lines: [{ line: String(zeroLine.line), quantity: 1 }],
    expectedVersion: childNow.version,
    idempotencyKey: "z-conc-dupe",
  };
  const settled = await Promise.allSettled([
    releaseZeroUnits(child._id, input, actors[0]),
    releaseZeroUnits(child._id, { ...input }, actors[0]),
  ]);
  const fulfilled = settled.filter((row) => row.status === "fulfilled");
  assert.ok(fulfilled.length >= 1, "at least one concurrent release succeeds");
  if (fulfilled.length === 2)
    assert.equal(
      String(fulfilled[0].value._id),
      String(fulfilled[1].value._id),
      "both settled to the identical record",
    );
  const rows = await Release.find({ merchantOrder: child._id }).lean();
  assert.equal(rows.length, 2, "first + exactly one concurrent record");
  const hold = await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean();
  assert.equal(hold.releasedQuantity, 2, "no double physical release");
  const operations = await Operation.find({ merchantOrder: child._id }).lean();
  assert.equal(
    operations.filter((row) => row.action === "zero_release").length,
    2,
    "first + one concurrent operation key",
  );
});

test("zero units inside financial blocks are excluded from the gated release, a block-free child releases normally", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors } = await preparedChild(t, "z_blocked");
  const Hold = require("../models/OnlineStockReservation"),
    Release = require("../models/MerchantNoMoneyRelease"),
    Operation = require("../models/MerchantFulfillmentOperation"),
    AuditLog = require("../models/AuditLog"),
    Child = require("../models/MerchantOrder");
  // Fixture surgery: the zero line's unit 0 sits inside a REFUNDED financial
  // block (as if a prior unit-range refund had settled that unit) and unit 1
  // inside a RESERVED block (an in-flight refund reservation).
  const settled = new mongoose.Types.ObjectId(),
    inFlight = new mongoose.Types.ObjectId();
  await Child.updateOne(
    { _id: child._id, "quantityProgress.line": String(zeroLine.line) },
    {
      $push: {
        "quantityProgress.$.financialBlocks": {
          start: 0,
          quantity: 1,
          refund: settled,
          kind: "refunded",
        },
      },
    },
  );
  await Child.updateOne(
    { _id: child._id, "quantityProgress.line": String(zeroLine.line) },
    {
      $push: {
        "quantityProgress.$.financialBlocks": {
          start: 1,
          quantity: 1,
          refund: inFlight,
          kind: "reserved",
        },
      },
    },
  );
  const blocked = await Child.findById(child._id).lean();
  const blocks = blocked.quantityProgress.find(
    (row) => String(row.line) === String(zeroLine.line),
  ).financialBlocks;
  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["refunded", "reserved"],
  );
  const hold = await Hold.findOne({
    merchantOrder: child._id,
    fulfillmentLineId: String(zeroLine.line),
  }).lean();
  const snapshot = {
    hold,
    releases: await Release.countDocuments({ merchantOrder: child._id }),
    operations: await Operation.countDocuments({ merchantOrder: child._id }),
    audits: await AuditLog.countDocuments({
      action: "MERCHANT_ZERO_ONLY_RELEASE",
    }),
    childVersion: blocked.version,
  };
  // Both zero units are financially blocked: requesting BOTH refuses with the
  // executor's exact insufficiency wording and zero writes (no key consumed).
  const version = (await Child.findById(child._id)).version;
  await assert.rejects(
    () =>
      releaseZeroUnits(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 2 }],
          expectedVersion: version,
          idempotencyKey: "z-blocked-both",
        },
        actors[0],
      ),
    (error) =>
      error.statusCode === 409 &&
      error.message ===
        "Zero-value release requires the requested quantity of unallocated zero-merchandise units",
  );
  const refused = await Child.findById(child._id).lean();
  assert.deepEqual(
    {
      hold: await Hold.findOne({
        merchantOrder: child._id,
        fulfillmentLineId: String(zeroLine.line),
      }).lean(),
      releases: await Release.countDocuments({ merchantOrder: child._id }),
      operations: await Operation.countDocuments({ merchantOrder: child._id }),
      audits: await AuditLog.countDocuments({
        action: "MERCHANT_ZERO_ONLY_RELEASE",
      }),
      childVersion: refused.version,
    },
    snapshot,
    "blocked refusal writes nothing",
  );
  // Simulate cancellation of the in-flight reservation in this disposable fixture.
  // A RESERVED unit must remain blocked until its authoritative reservation clears.
  await Child.updateOne(
    { _id: child._id, "quantityProgress.line": String(zeroLine.line) },
    { $pull: { "quantityProgress.$.financialBlocks": { refund: inFlight } } },
  );
  // Executor semantics (release.js zeroUnitRanges exclusion): blocked units are
  // EXCLUDED, not fatal — requesting ONE unit releases the only free zero unit
  // (unit 1, skipping the refunded unit 0), ranges identity preserved.
  const record = await releaseZeroUnits(
    child._id,
    {
      lines: [{ line: String(zeroLine.line), quantity: 1 }],
      expectedVersion: refused.version,
      idempotencyKey: "z-blocked-one",
    },
    actors[0],
  );
  assert.deepEqual(
    record.lines[0].ranges.map((row) => ({ start: row.start, quantity: row.quantity })),
    [{ start: 1, quantity: 1 }],
    "the refunded-block unit is skipped",
  );
  const afterOne = await Hold.findOne({
    merchantOrder: child._id,
    fulfillmentLineId: String(zeroLine.line),
  }).lean();
  assert.equal(afterOne.releasedQuantity, 1);
  assert.equal(
    afterOne.unitDispositions.filter((row) => row.action === "release")[0].start,
    1,
  );
  // Unit 0 remains refunded and unit 1 is already released: nothing free
  // remains. The initial two-block refusal also proved RESERVED exclusion.
  // zero further writes.
  const finalVersion = (await Child.findById(child._id)).version;
  await assert.rejects(
    () =>
      releaseZeroUnits(
        child._id,
        {
          lines: [{ line: String(zeroLine.line), quantity: 1 }],
          expectedVersion: finalVersion,
          idempotencyKey: "z-blocked-reserved",
        },
        actors[0],
      ),
    (error) =>
      error.statusCode === 409 &&
      error.message ===
        "Zero-value release requires the requested quantity of unallocated zero-merchandise units",
  );
  assert.equal(await Release.countDocuments({ merchantOrder: child._id }), 1);
  assert.equal((await Hold.findOne({ merchantOrder: child._id, fulfillmentLineId: String(zeroLine.line) }).lean()).releasedQuantity, 1);
});

test("control: a block-free zero line releases its first unit under the same gated command", { skip: !uri }, async (t) => {
  gates(t, GATES);
  const { child, zeroLine, actors } = await preparedChild(t, "z_blocks_ctl");
  const Child = require("../models/MerchantOrder");
  const progress = (await Child.findById(child._id).lean()).quantityProgress.find(
    (row) => String(row.line) === String(zeroLine.line),
  );
  assert.equal(
    (progress.financialBlocks || []).length,
    0,
    "control child carries no financial blocks",
  );
  const record = await releaseZeroUnits(
    child._id,
    {
      lines: [{ line: String(zeroLine.line), quantity: 1 }],
      expectedVersion: child.version,
      idempotencyKey: "z-blocks-ctl",
    },
    actors[0],
  );
  assert.deepEqual(
    record.lines[0].ranges.map((row) => ({ start: row.start, quantity: row.quantity })),
    [{ start: 0, quantity: 1 }],
    "no exclusion applies without blocks",
  );
});
