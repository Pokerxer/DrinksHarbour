"use strict";
// Shipping refund allocation edges (workstream S2) — recorded conditions are
// matched against the recorded policy; a recorded journal treatment demanding
// reversal of a nonexistent 4100 shipping-income journal fails closed and
// never invents a journal; bearer outcomes are recorded, never executed; the
// dispatch budget and original journals never move; foreign tenants are 404.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { orderFixture, recordPolicy, oid } = require("./helpers/merchantShippingRefundFixture");

const allocate = require("../services/merchantFulfillment/shippingRefund/allocate");
const FLAG = "MERCHANT_SHIPPING_REFUND_ALLOCATIONS_ENABLED";
const REVIEW =
  "Original shipping refund and carrier-charge allocation policy requires review.";

const command = (over = {}) => ({
  amountMinor: 500,
  idempotencyKey: "edge-1",
  eligibilityCondition: "failed_delivery",
  ...over,
});

test(
  "shipping refund allocation edges: condition matching, nonexistent-journal reversal, recorded-not-executed bearer, foreign-tenant 404",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "shipping_refund_edges");
    const Remainder = require("../models/MerchantShippingRefundRemainder"),
      Journal = require("../models/JournalEntry");
    const root = { _id: oid(), role: "super_admin" };
    const fx = await orderFixture();
    process.env[FLAG] = "true";
    t.after(() => {
      if (process.env[FLAG] === "true") delete process.env[FLAG];
    });
    const before = await fx.counts();
    const budgetBefore = await fx.budget();

    // Malformed command input is rejected before any gate or write.
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command({ idempotencyKey: "" }), root),
      (e) => e.statusCode === 400,
    );
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command({ amountMinor: 0 }), root),
      (e) => e.statusCode === 400,
    );

    // No recorded policy → verbatim readiness wording.
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command(), root),
      (e) => e.statusCode === 409 && e.message === REVIEW,
    );
    const policy = await recordPolicy();

    // A valid condition outside the recorded set fails closed explicitly.
    await assert.rejects(
      () =>
        allocate.allocateShippingRefund(
          fx.childId,
          command({ eligibilityCondition: "cancelled" }),
          root,
        ),
      /condition/i,
    );
    assert.deepEqual(await fx.counts(), before);

    // v2 records a journal treatment demanding 4100 reversal — but marketplace
    // orders never post 4100; the command fails closed and invents nothing.
    await recordPolicy({ version: 2, journalTreatment: "reverse_posted_4100_shipping_income" });
    const journalsAfterPolicy = await fx.counts();
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command(), root),
      (e) => e.statusCode === 409 && /journal/i.test(e.message),
    );
    assert.deepEqual(await fx.counts(), journalsAfterPolicy);

    // Once a posted 4100 shipping-income journal exists for the original
    // order, the recorded demand is satisfiable: the allocation RECORDS the
    // treatment (recorded, not executed) and posts no reversal itself.
    await Journal.collection.insertOne({
      tenant: fx.tenantId,
      refDoc: fx.orderId,
      refDocType: "Order",
      entryType: "manual",
      source: "shipping_income",
      status: "posted",
      lines: [{ account: "4100", debit: 0, credit: 10 }],
      date: new Date(),
    });
    const recorded = await allocate.allocateShippingRefund(fx.childId, command(), root);
    assert.equal(recorded.status, "allocated");
    assert.equal(recorded.journal.treatment, "reverse_posted_4100_shipping_income");
    assert.equal(recorded.journal.state, "recorded_not_executed");
    assert.equal(recorded.bearer.outcome, "customer_refund_source");
    assert.equal(recorded.bearer.state, "recorded_not_executed");
    assert.equal((await fx.counts()).journals, journalsAfterPolicy.journals + 1);
    assert.equal(await fx.budget(), budgetBefore);
    assert.equal((await Remainder.findById(fx.childId).lean()).allocatedMinor, 500);

    // A merchant_bears policy version records its outcome as data; nothing is
    // billed, recovered or journaled by the allocation mechanism.
    const other = await orderFixture();
    const otherBudgetBefore = await other.budget();
    await recordPolicy({ version: 3, bearerOutcome: "merchant_bears" });
    const borne = await allocate.allocateShippingRefund(
      other.childId,
      command({ idempotencyKey: "bearer-1" }),
      root,
    );
    assert.equal(borne.bearer.outcome, "merchant_bears");
    assert.equal(borne.bearer.state, "recorded_not_executed");
    assert.equal(await other.budget(), otherBudgetBefore);
    const otherCounts = await other.counts();
    assert.equal(otherCounts.journals, before.journals + 2);

    // Foreign-tenant actors: platform allocation denied 403; listing is 404.
    const stranger = { _id: oid(), role: "tenant_owner", tenant: oid() };
    await assert.rejects(
      () => allocate.allocateShippingRefund(fx.childId, command({ idempotencyKey: "x-2" }), stranger),
      /platform admin/i,
    );
    await assert.rejects(() => allocate.list(fx.childId, stranger), (e) => e.statusCode === 404);
    assert.equal((await allocate.list(fx.childId, root)).length, 1);

    // The readiness wording this mechanism reuses verbatim.
    const readiness = require("../services/merchantFulfillment/refundReadiness");
    const projection = readiness.project(
      {
        currency: "NGN",
        merchandiseMinor: 0,
        shippingMinor: 1000,
        taxMinor: 0,
        refundReservedMinor: 0,
        refundedMinor: 0,
      },
      null,
      "",
    );
    assert.equal(projection.shipping.reason, REVIEW);
  },
);
