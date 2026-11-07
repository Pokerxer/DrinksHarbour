"use strict";
// Shipping refund allocation command (workstream S2) — fail-closed gates with
// verbatim readiness wording and zero writes, receipt-identity binding to the
// single allocated claim + immutable child shippingMinor, once-only
// idempotency on a real concurrent Promise.all, exact remainder conservation,
// and a MerchantDispatchBudget that stays byte-identical in every customer-side
// refund path.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { orderFixture, recordPolicy, oid } = require("./helpers/merchantShippingRefundFixture");

const allocatePath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/shippingRefund/allocate.js",
);
const allocate = require("../services/merchantFulfillment/shippingRefund/allocate");
const FLAG = "MERCHANT_SHIPPING_REFUND_ALLOCATIONS_ENABLED";
const REVIEW =
  "Original shipping refund and carrier-charge allocation policy requires review.";

const command = (over = {}) => ({
  amountMinor: 600,
  idempotencyKey: "alloc-1",
  eligibilityCondition: "failed_delivery",
  ...over,
});

test(
  "shipping refund allocation fails closed without recorded policy, then binds receipt and shippingMinor once-only with exact conservation",
  { skip: !uri },
  async (t) => {
    assert.ok(require("node:fs").existsSync(allocatePath), "allocate command exists");
    await connectVenueMongo(t, "shipping_refund_allocate");
    const Allocation = require("../models/MerchantShippingRefundAllocation"),
      Remainder = require("../models/MerchantShippingRefundRemainder"),
      AuditLog = require("../models/AuditLog");
    const root = { _id: oid(), role: "super_admin" };
    const fx = await orderFixture();
    const before = await fx.counts();
    const budgetBefore = await fx.budget();

    // Gate A: default-off execution flag → verbatim readiness wording, zero writes.
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command(), root),
      (e) => e.statusCode === 409 && e.message === REVIEW,
    );
    assert.deepEqual(await fx.counts(), before);
    assert.equal(await fx.budget(), budgetBefore);

    // Gate B: flag on but no recorded policy → same explicit wording, zero writes.
    process.env[FLAG] = "true";
    t.after(() => {
      if (process.env[FLAG] === "true") delete process.env[FLAG];
    });
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command(), root),
      (e) => e.statusCode === 409 && e.message === REVIEW,
    );
    assert.deepEqual(await fx.counts(), before);
    assert.equal(await fx.budget(), budgetBefore);

    // Gate C: tenant actors are denied the platform allocation.
    await assert.rejects(
      () =>
        allocate.allocateShippingRefund(
          fx.childId,
          command(),
          { _id: oid(), role: "tenant_owner", tenant: fx.tenantId },
        ),
      /platform admin/i,
    );
    assert.deepEqual(await fx.counts(), before);
    assert.equal(await fx.budget(), budgetBefore);

    // Recorded policy → the allocation binds receipt identity, immutable
    // shippingMinor and the recorded bearer/journal treatment as data only.
    const policy = await recordPolicy();
    const first = await allocate.allocateShippingRefund(fx.childId, command(), root);
    assert.equal(first.status, "allocated");
    assert.equal(first.amountMinor, 600);
    assert.equal(first.shippingMinor, fx.shippingMinor);
    assert.equal(first.remainderMinorAfter, fx.shippingMinor - 600);
    assert.equal(first.receipt.provider, "stripe");
    assert.equal(first.receipt.account, "platform");
    assert.equal(first.receipt.reference, fx.claimReference);
    assert.equal(first.receipt.id, `stripe:platform:${fx.claimReference}`);
    assert.equal(String(first.customer), String(fx.customerId));
    assert.equal(first.eligibilityCondition, "failed_delivery");
    assert.equal(first.bearer.outcome, "customer_refund_source");
    assert.equal(first.bearer.state, "recorded_not_executed");
    assert.equal(first.journal.treatment, "no_shipping_income_journal");
    assert.equal(first.journal.state, "not_applicable");
    assert.equal(first.policy.version, policy.version);
    const stored = await Allocation.findById(first.allocationId).lean();
    assert.ok(stored, "allocation record exists");
    assert.equal(stored.state, "allocated");
    assert.equal(stored.remainderMinorAfter, fx.shippingMinor - 600);
    assert.equal((await Remainder.findById(fx.childId).lean()).allocatedMinor, 600);
    assert.deepEqual(await fx.counts(), {
      allocations: 1,
      remainders: 1,
      journals: before.journals,
    });
    assert.equal(await fx.budget(), budgetBefore, "dispatch budget byte-unchanged");
    assert.ok(
      await AuditLog.findOne({ action: "MERCHANT_SHIPPING_REFUND_ALLOCATION_RECORD" }),
      "allocation is audited",
    );

    // Sequential replay: same key → already_allocated, zero new writes.
    const replay = await allocate.allocateShippingRefund(fx.childId, command(), root);
    assert.equal(replay.status, "already_allocated");
    assert.equal(replay.allocationId, first.allocationId);
    assert.deepEqual(await fx.counts(), {
      allocations: 1,
      remainders: 1,
      journals: before.journals,
    });

    // Exact conservation: a second allocation consumes the remainder exactly.
    const second = await allocate.allocateShippingRefund(
      fx.childId,
      command({ amountMinor: fx.shippingMinor - 600, idempotencyKey: "alloc-2" }),
      root,
    );
    assert.equal(second.status, "allocated");
    assert.equal(second.remainderMinorAfter, 0);
    await assert.rejects(
      () =>
        allocate.allocateShippingRefund(
          fx.childId,
          command({ amountMinor: 1, idempotencyKey: "alloc-3" }),
          root,
        ),
      /remaining refundable shipping/i,
    );
    assert.equal((await Remainder.findById(fx.childId).lean()).allocatedMinor, fx.shippingMinor);
    assert.deepEqual(await fx.counts(), {
      allocations: 2,
      remainders: 1,
      journals: before.journals,
    });
    assert.equal(await fx.budget(), budgetBefore);

    // Concurrent duplicates (real Promise.all) resolve once-only.
    const race = await orderFixture();
    const raceBudget = await race.budget();
    const both = await Promise.all([
      allocate.allocateShippingRefund(
        race.childId,
        command({ amountMinor: 300, idempotencyKey: "race-1" }),
        root,
      ),
      allocate.allocateShippingRefund(
        race.childId,
        command({ amountMinor: 300, idempotencyKey: "race-1" }),
        root,
      ),
    ]);
    assert.deepEqual(
      both.map((row) => row.status).sort(),
      ["allocated", "already_allocated"],
    );
    assert.equal(both[0].allocationId, both[1].allocationId);
    assert.equal(both[0].amountMinor, both[1].amountMinor);
    assert.equal(
      (await Remainder.findById(race.childId).lean()).allocatedMinor,
      300,
      "remainder advanced exactly once",
    );
    assert.deepEqual(await race.counts(), {
      allocations: 3,
      remainders: 2,
      journals: 2,
    });
    assert.equal(await race.budget(), raceBudget);
  },
);
