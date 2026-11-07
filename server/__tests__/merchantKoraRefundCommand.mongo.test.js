"use strict";
// Kora refund gated COMMAND (workstream K) — fail-closed ladder, the recorded
// fallback-identity decision, once-only execution and exact claim-level
// conservation, on the real Mongo replica with real Promise.all races. The
// transport is injected and synthetic; no real Korapay call exists anywhere.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { korapayCheckoutFixture, paystackCheckoutFixture, recordPolicy, syntheticTransport, oid } =
  require("./helpers/koraRefundFixture");

const refundPath = require.resolve("../services/merchantFulfillment/koraRefund/refund.js");
const TENDER_REVIEW = "Original tender refund capability requires review.";
const FALLBACK_REVIEW =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
const NO_CLAIM_REVIEW = "No allocated original payment claim is recorded for this order.";
const FLAG = "MERCHANT_KORA_REFUNDS_ENABLED";

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
  "fail-closed ladder: flag off, no recorded policy, foreign tender, missing claim, bad key — verbatim wording, zero writes; tenant denied",
  { skip: !uri },
  async (t) => {
    assert.ok(require("node:fs").existsSync(refundPath), "koraRefund command module exists");
    const { counts, Allocation } = await connect(t, "kora_command_ladder");
    const refund = require(refundPath);
    const root = { _id: oid(), role: "super_admin" };
    delete process.env[FLAG];
    const gated = await korapayCheckoutFixture({ amountNaira: 20, fallback: true });

    // --- Flag off (default) → verbatim base wording, zero writes. ---
    await assert.rejects(
      () => refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "k-1" }, root),
      (error) => error.statusCode === 409 && error.message === TENDER_REVIEW,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- Flag on but no recorded policy → same explicit unsupported. ---
    process.env[FLAG] = "true";
    t.after(() => {
      delete process.env[FLAG];
    });
    await assert.rejects(
      () => refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "k-2" }, root),
      (error) => error.statusCode === 409 && error.message === TENDER_REVIEW,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- Tenant actor denied before any gate. ---
    await assert.rejects(
      () =>
        refund.refundKorapay(
          { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "k-3" },
          { _id: oid(), role: "tenant_owner", tenant: oid() },
        ),
      (error) => error.statusCode === 403,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- Missing idempotency key. ---
    await assert.rejects(
      () => refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500 }, root),
      /Idempotency-Key/i,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- No allocated claim for the order. ---
    await assert.rejects(
      () => refund.refundKorapay({ orderId: oid(), amountMinor: 500, idempotencyKey: "k-4" }, root),
      (error) => error.statusCode === 409 && error.message === NO_CLAIM_REVIEW,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- Allocated claim is not a Korapay receipt (other tenders stay with
    //     their own reviewed paths; the kora command refuses). ---
    const ps = await paystackCheckoutFixture({});
    await assert.rejects(
      () => refund.refundKorapay({ orderId: ps.orderId, amountMinor: 500, idempotencyKey: "k-5" }, root),
      (error) => error.statusCode === 409 && error.message === TENDER_REVIEW,
    );
    assert.equal(await Allocation.countDocuments(), 0);
  },
);

test(
  "recorded identity decision gates the fallback receipt; acceptance executes once-only with exact claim conservation",
  { skip: !uri },
  async (t) => {
    const { Allocation, Remainder, Evidence, counts } = await connect(t, "kora_command_lifecycle");
    const refund = require(refundPath);
    const root = { _id: oid(), role: "super_admin" };
    process.env[FLAG] = "true";

    // --- Recorded policy that KEEPS the fallback identity refused: verbatim
    //     discovery wording, zero writes. ---
    const gated = await korapayCheckoutFixture({ amountNaira: 20, fallback: true });
    await recordPolicy({ acceptFallbackTransactionId: false });
    await assert.rejects(
      () => refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "fb-1" }, root),
      (error) => error.statusCode === 409 && error.message === FALLBACK_REVIEW,
    );
    assert.deepEqual(await counts(), { allocations: 0, remainders: 0, evidence: 0 });

    // --- Accepted identity decision (version 2): the ambiguous fallback
    //     receipt becomes eligible as data and the command executes. ---
    await recordPolicy({ acceptFallbackTransactionId: true, refundFeeBearer: "platform_bears" });
    const successTransportOnce = syntheticTransport({
      request: { status: "success", providerRefundId: "KRF-100", amountMinor: 500, currency: "NGN" },
    });
    const result = await refund.refundKorapay(
      { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "fb-2" },
      root,
      { transport: successTransportOnce },
    );
    assert.equal(result.status, "settled");
    assert.equal(result.providerRefundId, "KRF-100");
    assert.equal(result.amountMinor, 500);
    assert.equal(result.remainderMinor, 1500);
    assert.equal(result.fallbackAccepted, true);
    assert.equal(result.policy.version, 2);
    assert.equal(result.feeTreatment.bearer, "platform_bears");
    assert.equal(result.feeTreatment.state, "recorded_not_executed");
    // The sealed transport passed the recorded contract through.
    assert.equal(successTransportOnce.calls.length, 1);
    assert.ok(successTransportOnce.calls[0].envelope.endpointsShapeReference);
    assert.ok(successTransportOnce.calls[0].envelope.authMode);

    // Once-only evidence in MerchantRefundEvidence _id semantics.
    const evidence = await Evidence.findOne({}).lean();
    assert.equal(evidence._id, "korapay:platform:KRF-100");
    assert.equal(evidence.amountMinor, 500);
    assert.equal(evidence.currency, "NGN");

    const allocation = await Allocation.findOne({}).lean();
    assert.equal(allocation.claim, gated.claimId);
    assert.equal(allocation.state, "settled");
    assert.equal(allocation.receiptTransactionId, null);
    assert.equal(allocation.fallbackAccepted, true);

    // --- Sequential replay: same key → same recorded result, zero writes. ---
    const replay = await refund.refundKorapay(
      { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "fb-2" },
      root,
      { transport: syntheticTransport({}) },
    );
    assert.equal(replay.status, "already_settled");
    assert.equal(replay.providerRefundId, "KRF-100");
    assert.deepEqual(await counts(), { allocations: 1, remainders: 1, evidence: 1 });

    // --- Conservation vs the claim amount/currency: partial refunds split the
    //     exact claim amount; over-refund refused; exact remainder closes. ---
    const p1 = await refund.refundKorapay({ orderId: gated.orderId, amountMinor: 1000, idempotencyKey: "fb-3" }, root, {
      transport: syntheticTransport({
        request: { status: "success", providerRefundId: "KRF-101", amountMinor: 1000, currency: "NGN" },
      }),
    });
    assert.equal(p1.remainderMinor, 500);
    await assert.rejects(
      () =>
        refund.refundKorapay({ orderId: gated.orderId, amountMinor: 600, idempotencyKey: "fb-4" }, root, {
          transport: syntheticTransport({}),
        }),
      /remaining refundable/i,
    );
    assert.deepEqual(await counts(), { allocations: 2, remainders: 1, evidence: 2 });
    const p2 = await refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "fb-5" }, root, {
      transport: syntheticTransport({
        request: { status: "success", providerRefundId: "KRF-102", amountMinor: 500, currency: "NGN" },
      }),
    });
    assert.equal(p2.remainderMinor, 0);
    await assert.rejects(
      () => refund.refundKorapay({ orderId: gated.orderId, amountMinor: 1, idempotencyKey: "fb-6" }, root, {
        transport: syntheticTransport({}),
      }),
      /remaining refundable/i,
    );
    const remainder = await Remainder.findOne({}).lean();
    assert.equal(remainder.originalMinor, 2000);
    assert.equal(remainder.refundedMinor, 2000);

    // --- Distinct transactionId receipt: eligible as data, identity recorded. ---
    const distinct = await korapayCheckoutFixture({ amountNaira: 10, fallback: false });
    await assert.rejects(
      () => refund.refundKorapay({ orderId: distinct.orderId, amountMinor: 0, idempotencyKey: "fb-7" }, root, {
        transport: syntheticTransport({}),
      }),
      /positive integer/i,
    );
    assert.deepEqual(await counts(), { allocations: 3, remainders: 1, evidence: 3 });
    const distinctResult = await refund.refundKorapay(
      { orderId: distinct.orderId, amountMinor: 300, idempotencyKey: "fb-8" },
      root,
      { transport: syntheticTransport({ request: { status: "success", providerRefundId: "KRF-110", amountMinor: 300, currency: "NGN" } }) },
    );
    assert.equal(distinctResult.status, "settled");
    assert.equal(distinctResult.fallbackAccepted, false);
    const distinctRow = await Allocation.findOne({ claim: distinct.claimId }).lean();
    assert.equal(distinctRow.receiptTransactionId, distinct.transactionId);

    // --- Concurrent identical commands resolve once-only via real Promise.all.
    //     Reserve-then-post: the loser's conservation claim aborts on the
    //     anchor and it NEVER reaches the provider; exactly ONE transport
    //     call happens across both instances. ---
    const race = await korapayCheckoutFixture({ amountNaira: 3, fallback: false });
    const settleOutcome = { request: { status: "success", providerRefundId: "KRF-120", amountMinor: 300, currency: "NGN" } };
    const firstTransport = syntheticTransport(settleOutcome);
    const secondTransport = syntheticTransport(settleOutcome);
    const both = await Promise.all([
      refund.refundKorapay({ orderId: race.orderId, amountMinor: 300, idempotencyKey: "race-1" }, root, {
        transport: firstTransport,
      }),
      refund.refundKorapay({ orderId: race.orderId, amountMinor: 300, idempotencyKey: "race-1" }, root, {
        transport: secondTransport,
      }),
    ]);
    const statuses = both.map((r) => r.status).sort();
    assert.ok(
      [["replayed", "settled"], ["already_settled", "replayed"], ["already_settled", "settled"]].some(
        (allowed) => JSON.stringify(allowed) === JSON.stringify(statuses),
      ),
      `exactly one settle and one write-free replay: ${JSON.stringify(statuses)}`,
    );
    assert.equal(firstTransport.calls.length + secondTransport.calls.length, 1);
    assert.equal(await Allocation.countDocuments(), 5);
    assert.equal(await Remainder.countDocuments(), 3);
    assert.equal(await Evidence.countDocuments(), 5);
    const raceRow = await Allocation.findOne({ claim: race.claimId }).lean();
    assert.equal(raceRow.amountMinor, 300);
    assert.equal(raceRow.state, "settled");
  },
);

test(
  "F1 review-fix: a POST-settle success whose reported evidence does not match the recorded allocation refuses settlement — verbatim adapter wording, zero evidence/settle writes, reservation held",
  { skip: !uri },
  async (t) => {
    const { Allocation, Remainder, Evidence, counts } = await connect(t, "kora_command_evidence");
    const refund = require(refundPath);
    const root = { _id: oid(), role: "super_admin" };
    process.env[FLAG] = "true";
    t.after(() => {
      delete process.env[FLAG];
    });

    // Mirrors adapter.js assertEvidence verbatim — surfaced, never reworded.
    const EVIDENCE_MISMATCH = "Provider refund evidence does not match the recorded Kora allocation.";

    const gated = await korapayCheckoutFixture({ amountNaira: 20, fallback: true });
    await recordPolicy({ acceptFallbackTransactionId: true });

    // --- Reported amount DIFFERS from the claimed allocation (500 requested,
    //     the transport success reports 400): the POST-settle path must refuse
    //     with the adapter's verbatim evidence-mismatch conflict wording,
    //     ZERO evidence/settle writes, the reservation stays held. ---
    const amountMismatch = syntheticTransport({
      request: { status: "success", providerRefundId: "KRF-900", amountMinor: 400, currency: "NGN" },
    });
    await assert.rejects(
      () =>
        refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "ev-1" }, root, {
          transport: amountMismatch,
        }),
      (error) => error.statusCode === 409 && error.message === EVIDENCE_MISMATCH,
    );
    assert.equal(
      amountMismatch.calls.length,
      1,
      "the single provider POST ran once; the mismatched report is refused, never settled",
    );
    const refused = await Allocation.findOne({}).lean();
    assert.ok(refused, "the once-only anchor reservation persists");
    assert.equal(refused.state, "requested");
    assert.ok(!refused.issue, "no uncertainty issue is invented for a refused evidence mismatch");
    assert.ok(!refused.providerRefundId, "the mismatched provider refund id is never saved");
    assert.equal((await Remainder.findOne({}).lean()).refundedMinor, 500, "the conservation reservation stays held");
    assert.equal(await Evidence.countDocuments(), 0);

    // --- Reported currency differs (`USD` vs the recorded NGN): same verbatim
    //     refusal — a second reservation is claimed but nothing settles. ---
    const currencyMismatch = syntheticTransport({
      request: { status: "success", providerRefundId: "KRF-901", amountMinor: 500, currency: "USD" },
    });
    await assert.rejects(
      () =>
        refund.refundKorapay({ orderId: gated.orderId, amountMinor: 500, idempotencyKey: "ev-2" }, root, {
          transport: currencyMismatch,
        }),
      (error) => error.statusCode === 409 && error.message === EVIDENCE_MISMATCH,
    );
    assert.equal(currencyMismatch.calls.length, 1);
    assert.equal(await Evidence.countDocuments(), 0);
    assert.equal(await Allocation.countDocuments(), 2);
    assert.equal((await Remainder.findOne({}).lean()).refundedMinor, 1000, "both reservations stay held, never released");

    // --- Control: an exactly matching success still settles once. ---
    const matching = syntheticTransport({
      request: { status: "success", providerRefundId: "KRF-902", amountMinor: 500, currency: "NGN" },
    });
    const settled = await refund.refundKorapay(
      { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "ev-3" },
      root,
      { transport: matching },
    );
    assert.equal(settled.status, "settled");
    assert.equal(settled.providerRefundId, "KRF-902");
    assert.deepEqual(await counts(), { allocations: 3, remainders: 1, evidence: 1 });
    assert.equal((await Evidence.findOne({}).lean()).amountMinor, 500);
  },
);
