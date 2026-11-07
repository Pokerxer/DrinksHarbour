"use strict";
// Kora refund UNCERTAINTY + reconcile edges (workstream K) — adapter-level
// single_POST-style unknown outcome: the allocation stays reserved-uncertain,
// the conservation remainder stays held, and only an authenticated reconcile
// by the SAVED provider refund id settles — once-only; duplicate/late
// confirmations cannot duplicate. Reconciliation without a saved id refuses;
// the mechanism never discovers or invents provider ids.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { korapayCheckoutFixture, recordPolicy, syntheticTransport, oid } =
  require("./helpers/koraRefundFixture");

const refundPath = require.resolve("../services/merchantFulfillment/koraRefund/refund.js");
const adapterPath = require.resolve("../services/merchantFulfillment/koraRefund/adapter.js");
const FLAG = "MERCHANT_KORA_REFUNDS_ENABLED";
const ISSUE = "Synthetic timeout after send; the refund outcome is unknown at the provider.";

async function connect(t, suffix) {
  await connectVenueMongo(t, suffix);
  const Allocation = require("../models/MerchantKoraRefundAllocation");
  const Remainder = require("../models/MerchantKoraRefundRemainder");
  const Evidence = require("../models/MerchantKoraRefundEvidence");
  const counts = async () => ({
    allocations: await Allocation.countDocuments(),
    remainders: await Remainder.countDocuments(),
    evidence: await Evidence.countDocuments(),
  });
  return { Allocation, Remainder, Evidence, counts };
}

test(
  "unknown POST outcome leaves the allocation reserved-uncertain; only authenticated reconcile by the saved provider refund id settles — once-only",
  { skip: !uri },
  async (t) => {
    const { Allocation, Evidence, counts } = await connect(t, "kora_uncertain_reconcile");
    const refund = require(refundPath);
    const root = { _id: oid(), role: "super_admin" };
    process.env[FLAG] = "true";
    t.after(() => delete process.env[FLAG]);
    await recordPolicy({ acceptFallbackTransactionId: true });

    // --- Single POST-style unknown outcome: transport reports unknown AFTER send. ---
    const checkout = await korapayCheckoutFixture({ amountNaira: 20, fallback: false });
    const transport = syntheticTransport({
      request: { status: "unknown", providerRefundId: "KRF-500", issue: ISSUE },
      verify: { status: "success", providerRefundId: "KRF-500", amountMinor: 500, currency: "NGN" },
    });
    const result = await refund.refundKorapay(
      { orderId: checkout.orderId, amountMinor: 500, idempotencyKey: "un-1" },
      root,
      { transport },
    );
    assert.equal(result.status, "uncertain");
    assert.equal(result.state, "uncertain");
    assert.equal(result.issue, ISSUE);
    assert.equal(result.providerRefundId, "KRF-500");
    assert.equal(result.remainderMinor, 1500);
    assert.equal(await Allocation.countDocuments(), 1);
    assert.equal(await Evidence.countDocuments(), 0);
    const row = await Allocation.findOne({}).lean();
    assert.equal(row.state, "uncertain");
    assert.equal(row.providerRefundId, "KRF-500");

    // --- Replay while uncertain: result rebuilt, zero writes, no re-submit. ---
    const replay = await refund.refundKorapay(
      { orderId: checkout.orderId, amountMinor: 500, idempotencyKey: "un-1" },
      root,
      { transport: syntheticTransport({}) },
    );
    assert.equal(replay.status, "replayed");
    assert.equal(replay.state, "uncertain");
    assert.equal(replay.providerRefundId, "KRF-500");
    assert.equal(transport.calls.length, 1, "the provider request is never sent twice for one command key");
    assert.deepEqual(await counts(), { allocations: 1, remainders: 1, evidence: 0 });

    // --- Concurrent different-key commands during uncertainty still conserve
    //     the claim remainder exactly: another 500+1000 leaves 0; the next
    //     1-minor attempt is refused with zero writes. ---
    const second = await refund.refundKorapay(
      { orderId: checkout.orderId, amountMinor: 500, idempotencyKey: "un-2" },
      root,
      // The provider misreports the SAME refund id here — a distinct allocation
      // must never be able to settle through the same evidence id.
      { transport: syntheticTransport({ request: { status: "unknown", providerRefundId: "KRF-500", issue: ISSUE } }) },
    );
    assert.equal(second.status, "uncertain");
    assert.equal(second.providerRefundId, "KRF-500");
    const third = await refund.refundKorapay(
      { orderId: checkout.orderId, amountMinor: 1000, idempotencyKey: "un-3" },
      root,
      { transport: syntheticTransport({ request: { status: "unknown", issue: ISSUE } }) },
    );
    assert.equal(third.status, "uncertain");
    assert.equal(third.remainderMinor, 0);
    await assert.rejects(
      () =>
        refund.refundKorapay({ orderId: checkout.orderId, amountMinor: 1, idempotencyKey: "un-4" }, root, {
          transport: syntheticTransport({}),
        }),
      /remaining refundable/i,
    );
    const thirdRow = await Allocation.findOne({ state: "uncertain", amountMinor: 1000 }).lean();
    assert.ok(thirdRow, "the third uncertain allocation exists");

    // --- Reconciliation by the SAVED provider refund id (once-only). ---
    const reconciled = await refund.reconcileKorapay({ allocationId: String(row._id) }, root, {
      transport: syntheticTransport({
        verify: { status: "success", providerRefundId: "KRF-500", amountMinor: 500, currency: "NGN" },
      }),
    });
    assert.equal(reconciled.status, "settled");
    assert.equal(reconciled.providerRefundId, "KRF-500");
    const evidence = await Evidence.findOne({ _id: "korapay:platform:KRF-500" }).lean();
    assert.equal(String(evidence.allocation), String(row._id));
    assert.equal((await Allocation.findById(row._id).lean()).state, "settled");

    // --- Late duplicate confirmation of the SAME evidence: replay, no dup. ---
    const late = await refund.reconcileKorapay({ allocationId: String(row._id) }, root, {
      transport: syntheticTransport({}),
    });
    assert.equal(late.status, "already_settled");
    assert.equal(await Evidence.countDocuments({ _id: "korapay:platform:KRF-500" }), 1);

    // --- The same provider refund id cannot serve another allocation. ---
    const secondRow = await Allocation.findOne({ providerRefundId: "KRF-500", _id: { $ne: row._id } }).lean();
    assert.ok(secondRow, "the id-collision allocation exists");
    const outcome = await refund
      .reconcileKorapay(
        { allocationId: String(secondRow._id) },
        root,
        {
          transport: syntheticTransport({
            verify: { status: "success", providerRefundId: "KRF-500", amountMinor: 500, currency: "NGN" },
          }),
        },
      )
      .then(
        () => assert.fail("expected rejection"),
        (error) => error,
      );
    assert.match(outcome.message, /already used/i);
    assert.equal(await Evidence.countDocuments(), 1);
  },
);

test(
  "uncertainty without a saved provider refund id cannot be reconciled — the mechanism never discovers or invents ids; the sealed adapter refuses absent contracts and transport",
  { skip: !uri },
  async (t) => {
    const { counts } = await connect(t, "kora_orphan_uncertain");
    const refund = require(refundPath);
    const adapter = require(adapterPath);
    const root = { _id: oid(), role: "super_admin" };
    process.env[FLAG] = "true";
    t.after(() => delete process.env[FLAG]);
    await recordPolicy({ acceptFallbackTransactionId: true });

    const checkout = await korapayCheckoutFixture({ amountNaira: 10, fallback: false });
    const each = await refund.refundKorapay(
      { orderId: checkout.orderId, amountMinor: 400, idempotencyKey: "orph-1" },
      root,
      { transport: syntheticTransport({ request: { status: "unknown", issue: ISSUE } }) },
    );
    assert.equal(each.status, "uncertain");
    assert.equal(each.providerRefundId, null);
    const allocation = await require("../models/MerchantKoraRefundAllocation").findOne({}).lean();

    await assert.rejects(
      () => refund.reconcileKorapay({ allocationId: String(allocation._id) }, root, { transport: syntheticTransport({}) }),
      /saved provider refund id/i,
    );
    assert.deepEqual(await counts(), { allocations: 1, remainders: 1, evidence: 0 });

    // Adapter-level sealing (no command run): a policy whose recorded contract
    // facts are absent is refused; a complete contract with no transport is
    // refused because the real transport is deliberately not installed.
    const policy = await recordPolicy({ acceptFallbackTransactionId: true, decisionReference: "ADAPTER-1" });
    await assert.rejects(
      () => adapter.submit({ policy: { endpointsShapeReference: "only one field" }, allocation }, syntheticTransport({})),
      /incomplete/i,
    );
    await assert.rejects(
      () => adapter.submit({ policy, allocation }, null),
      /not installed/i,
    );
    await adapter.submit({ policy, allocation }, syntheticTransport({ request: { status: "success", providerRefundId: "KRF-1", amountMinor: allocation.amountMinor, currency: "NGN" } }));
  },
);
