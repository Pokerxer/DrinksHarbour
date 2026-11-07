"use strict";
// Recorded policy-registry fixtures — real replica. Synthetic policy rows are
// created through each mechanism's own recording function (super-admin
// actor); the registry/readiness projections must then surface recorded
// state, active versions and each mechanism's verbatim gate-order wording —
// read-only throughout.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { connectVenueMongo } = require("./helpers/venueMongo");

const TENDER = "Original tender refund capability requires review.";
const PAYOUT = "No payout execution exists; payout policy requires review.";
const KORA_SEAL =
  "Kora refund transport is not installed; the recorded protocol contract requires external certification before a real transport is wired.";
const PAYOUT_SEAL =
  "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).";
const FEE_NOTE =
  "No provider fee records exist; treatment is recorded-not-measured. Recorded bearer decisions surface as data only.";
const SHIPPING =
  "Original shipping refund and carrier-charge allocation policy requires review.";
const TAX = "Original tax refund and journal allocation policy requires review.";
const ZERO =
  "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.";
const RETURN_EFFECTS =
  "Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported";
const RECORDED_NOTE =
  "Recorded policy versions exist; this read-only registry projects them as data and never executes anything.";

async function actor() {
  const _id = new mongoose.Types.ObjectId();
  await require("../models/User").collection.insertOne({
    _id,
    email: `super-${_id}@example.test`,
    role: "super_admin",
    status: "active",
  });
  return { _id, role: "super_admin" };
}

async function recordAll() {
  const operator = await actor();
  const tenant = new mongoose.Types.ObjectId();
  await require("../services/merchantFulfillment/koraRefund/policy").record(
    {
      endpointsShapeReference:
        "Synthetic registry fixture: reviewed Kora refund endpoint shape reference (test only)",
      authMode: "bearer_server_side_synthetic",
      refundRequestContract:
        "Synthetic recorded refund request contract for the platform-ops registry fixture",
      refundResponseContract:
        "Synthetic recorded refund response contract for the platform-ops registry fixture",
      uncertaintyBehavior:
        "Synthetic recorded uncertainty behavior: unknown stays reserved and reconciles once",
      idempotencyConvention:
        "Synthetic recorded provider idempotency key convention; replays never resubmit",
      acceptFallbackTransactionId: true,
      refundFeeBearer: "merchant_bears",
    },
    operator
  );
  await require("../services/merchantFulfillment/payout/policy").record(
    {
      scheduleRule: "Synthetic registry payout schedule rule (test only)",
      currencyMode: "original_transaction_currency",
      destinationAccountSource: "tenant_payout_account_reference",
      holdRegime: "recorded_holds_and_standing_minor",
      clawbackRule: "none_recorded",
      nettingRule: "statement_net_receivable_only",
      minimumThresholdMinor: 100,
    },
    operator
  );
  await require("../services/merchantFulfillment/feeTreatment/policy").record(
    {
      flows: ["kora_refund"],
      bearer: "merchant_bears",
      futureJournalTreatment: "no_provider_fee_journal_until_fee_account_exists",
      historicalFeeRule: "none_recorded_stays_unknown",
    },
    operator
  );
  await require("../services/delivery/returnDisposition/policy").recordPolicy(
    {
      tenant,
      version: 1,
      treatmentByCondition: {
        sealed: "restock",
        damaged: "write_off",
        expired: "write_off",
        unverifiable: "retain_quarantine",
      },
      restockLocationRule: "original_location",
      cogsTreatment: "reverse_original_goods_cost",
      reviewReference: "Synthetic registry disposition review reference",
    },
    operator
  );
  await require("../services/merchantFulfillment/shippingRefund/policy").record(
    {
      eligibilityConditions: ["cancelled"],
      bearerOutcome: "merchant_bears",
      journalTreatment: "no_shipping_income_journal",
    },
    operator
  );
  const component = require("../services/merchantFulfillment/componentRefund/policy");
  await component.record(
    {
      kind: "tax",
      jurisdiction: "NG-FCT",
      rateAuthority: "Synthetic registry VAT authority (test only)",
      bearer: "platform_bears",
      reversalTreatment: "no_output_vat_captured",
    },
    operator
  );
  await component.record(
    {
      kind: "discount",
      eligibleFunding: ["platform"],
      platformRecreditPath: "component_record_only",
    },
    operator
  );
  await require("../services/merchantFulfillment/quantity/zeroOnlyRelease/policy").recordPolicy(
    {
      tenant,
      version: 1,
      recordShape: "zero_release_v1",
      scopeRule: "zero_merchandise_only",
      auditWording: "Synthetic registry no-money release audit wording",
    },
    operator
  );
  const storedValue = require("../services/merchantFulfillment/refundSources/policyAuthority");
  await storedValue.record(
    {
      kind: "wallet",
      destination: "original_object",
      amountPrecisionRule: "whole_naira_units",
    },
    operator
  );
  await storedValue.record(
    {
      kind: "gift_card",
      destination: "original_object",
      amountPrecisionRule: "whole_naira_units",
      giftExpiryRule: "reactivate_expired_card",
    },
    operator
  );
  return { operator, tenant };
}

test("recorded fixtures surface with whitelisted versions and zero-write registry reads", async (t) => {
  await connectVenueMongo(t, "ops_regrec");
  const { operator } = await recordAll();
  const registry = require("../services/operations/policyRegistry");
  const snapshot = await registry.snapshot(operator);
  const byName = new Map(snapshot.mechanisms.map((row) => [row.mechanism, row]));

  const expectEntry = (name, { versions, activeVersion, reason }) => {
    const entry = byName.get(name);
    assert.equal(entry.policy.state, "recorded", name);
    assert.equal(entry.policy.recordedVersions, versions);
    assert.equal(entry.policy.activeVersion, activeVersion, name);
    assert.equal(entry.reason, reason, `${name} reason`);
    for (const version of entry.policy.versions)
      assert.deepEqual(Object.keys(version).sort(), [
        "decisionReference",
        "effectiveFrom",
        "effectiveUntil",
        "state",
        "version",
      ]);
  };
  expectEntry("kora_refund", { versions: 1, activeVersion: 1, reason: TENDER });
  expectEntry("payout_transfer", { versions: 1, activeVersion: 1, reason: PAYOUT });
  // Flag on: the transport seal becomes the next refusal surface (verbatim).
  process.env.MERCHANT_KORA_REFUNDS_ENABLED = "true";
  process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
  try {
    const flipped = await registry.snapshot(operator);
    const flippedByName = new Map(flipped.mechanisms.map((r) => [r.mechanism, r]));
    assert.equal(flippedByName.get("kora_refund").reason, KORA_SEAL);
    assert.equal(flippedByName.get("kora_refund").flag.enabled, true);
    assert.equal(flippedByName.get("payout_transfer").reason, PAYOUT_SEAL);
  } finally {
    delete process.env.MERCHANT_KORA_REFUNDS_ENABLED;
    delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
  }
  expectEntry("shipping_refund_allocation", { versions: 1, activeVersion: 1, reason: RECORDED_NOTE });
  expectEntry("tax_component_refund", { versions: 1, activeVersion: 1, reason: RECORDED_NOTE });
  expectEntry("discount_component_refund", { versions: 1, activeVersion: 1, reason: RECORDED_NOTE });
  expectEntry("zero_only_release", { versions: 1, activeVersion: null, reason: RECORDED_NOTE });
  expectEntry("return_disposition", { versions: 1, activeVersion: null, reason: RECORDED_NOTE });
  expectEntry("stored_value_wallet_refund", { versions: 1, activeVersion: 1, reason: RECORDED_NOTE });
  expectEntry("stored_value_gift_card_refund", { versions: 1, activeVersion: 1, reason: RECORDED_NOTE });

  const fee = byName.get("fee_treatment");
  const koraFlow = fee.feeFlows.find((flow) => flow.flow === "kora_refund");
  assert.equal(koraFlow.state, "recorded");
  assert.equal(koraFlow.bearer, "merchant_bears");
  assert.equal(koraFlow.policyVersion, 1);
  assert.equal(fee.feeFlows.filter((flow) => flow.state === "not_recorded").length, 5);

  // Zero-write idempotency: double read JSON-identical; counts unchanged.
  const before = await Promise.all(
    [
      require("../models/MerchantKoraRefundPolicy"),
      require("../models/MerchantPayoutPolicy"),
      require("../models/MerchantFeeTreatmentPolicy"),
    ].map((m) => m.countDocuments({}))
  );
  const auditBefore = await require("../models/AuditLog").countDocuments({});
  const second = JSON.stringify(await registry.snapshot(operator));
  assert.equal(second, JSON.stringify(await registry.snapshot(operator)));
  const auditAfter = await require("../models/AuditLog").countDocuments({});
  assert.equal(auditAfter, auditBefore);
  assert.deepEqual(
    await Promise.all(
      [
        require("../models/MerchantKoraRefundPolicy"),
        require("../models/MerchantPayoutPolicy"),
        require("../models/MerchantFeeTreatmentPolicy"),
      ].map((m) => m.countDocuments({}))
    ),
    before
  );
});

test("readiness surfaces the mechanisms with verbatim gate orderings and unchanged gates", async (t) => {
  await connectVenueMongo(t, "ops_regreadiness");
  const { operator } = await recordAll();
  const readiness = require("../services/operations/readiness");
  const snapshot = await readiness.snapshot(operator);
  assert.equal(snapshot.readinessVersion, 2);
  assert.equal(snapshot.notice, "Readiness evidence is not activation permission.");
  assert.equal(snapshot.flags.merchantKoraRefundsEnabled, false);
  assert.equal(snapshot.flags.merchantPayoutTransfersEnabled, false);

  const koraReady = snapshot.mechanisms.koraRefund;
  assert.equal(koraReady.state, "recorded_not_executed");
  assert.equal(koraReady.reason, TENDER); // flag off ⇒ the flag gate wording
  assert.equal(koraReady.policy.state, "recorded");
  assert.equal(koraReady.policy.activeVersion, 1);
  assert.equal(koraReady.unresolvedReservations, 0);
  const payoutReady = snapshot.mechanisms.payoutTransfer;
  assert.equal(payoutReady.state, "recorded_not_executed");
  assert.equal(payoutReady.reason, PAYOUT);
  assert.equal(payoutReady.unresolvedTransfers, 0);

  // Flag-on flips the refusal surface to each mechanism's own seal wording.
  process.env.MERCHANT_KORA_REFUNDS_ENABLED = "true";
  process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
  try {
    const flipped = await readiness.snapshot(operator);
    assert.equal(flipped.mechanisms.koraRefund.reason, KORA_SEAL);
    assert.equal(flipped.mechanisms.payoutTransfer.reason, PAYOUT_SEAL);
  } finally {
    delete process.env.MERCHANT_KORA_REFUNDS_ENABLED;
    delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
  }

  // Fee-treatment block is the projection's own operator view (verbatim).
  const fee = snapshot.mechanisms.feeTreatment;
  assert.equal(fee.projectionVersion, 1);
  assert.equal(fee.note, FEE_NOTE);
  assert.equal(fee.flows.find((flow) => flow.flow === "kora_refund").state, "recorded");
  assert.equal(
    fee.flows.find((flow) => flow.flow === "merchandise_refund").reason,
    "Provider fee bearer, future-fee treatment and historical-fee rule for this flow are not recorded; fee treatment authority fails closed until a super admin records a version."
  );
  assert.equal(fee.accounting.feeAccountExists, false);

  // No private material anywhere in the readiness snapshot.
  const snapshotText = JSON.stringify(snapshot);
  assert.equal(snapshotText.includes("Minor"), false, "no amounts/figures in readiness");
  assert.equal(snapshotText.includes("contentHash"), false);

  // Established reviewed gates remain byte-identical.
  assert.equal(
    snapshot.shipping.reason,
    "Original shipping refund and carrier-charge allocation policy requires review."
  );
  assert.equal(snapshot.tax.reason, TAX);
  assert.equal(snapshot.payout.reason,
    "Saved tenant receivable and commission shares are reversed by verified merchandise settlement. Payout transfer, fee recovery and distribution approval remain separate.");
  assert.equal(snapshot.zeroValueCancellation.reason, ZERO);
  assert.equal(snapshot.returns.reason, RETURN_EFFECTS);
  assert.equal(snapshot.returns.effectsSupported, false);
  assert.equal(snapshot.returns.effectsFlagEnabled, false);
  const counts = snapshot.queueCounts;
  assert.equal(counts.refund, 0);
  assert.equal(counts.carrier, 0);
  assert.equal(counts.return, 0);
});
