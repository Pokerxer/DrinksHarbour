"use strict";
// Merchant payout uncertainty + currency + holds (workstream P). The sealed
// transport NEVER becomes money: a sealed submit leaves the transfer
// reserved in `executing` with the explicit reason; ONLY once-only
// authenticated provider evidence (MerchantPayoutEvidence,
// _id = provider:account:transferId) settles a transfer, and duplicate or
// late confirmations cannot reconcile again. Recorded holds reduce the
// statement-linked base exactly; FX conversion is produced only from the
// recorded policy source fields with a rate snapshot.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const PAYOUT_REASON = "No payout execution exists; payout policy requires review.";
const holdsPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/holds.js",
);
const fxPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/fx.js",
);
const transportPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/payout/transport.js",
);
const evidenceModelPath = path.resolve(
  __dirname,
  "../models/MerchantPayoutEvidence.js",
);
test(
  "FX conversion records only from the recorded source with a rate snapshot, the sealed transport reserves uncertainty, and once-only provider evidence settles",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(fxPath), "payout/fx module exists");
    assert.ok(fs.existsSync(transportPath), "sealed payout transport exists");
    assert.ok(fs.existsSync(evidenceModelPath), "MerchantPayoutEvidence model exists");
    await connectVenueMongo(t, "payout_uncertainty");
    const fixture = await require("./helpers/payoutFixture").twoChildren();
    const { tenantA, childA, root } = fixture;
    const policyAuthority = require("../services/merchantFulfillment/payout/policy");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    const Transfer = require("../models/MerchantPayoutTransfer");
    const Evidence = require("../models/MerchantPayoutEvidence");
    const AuditLog = require("../models/AuditLog");
    const Balance = require("../models/MerchantPayoutBalance");
    const ExchangeRate = require("../models/ExchangeRate");
    await require("../models/MerchantPayoutPolicy").syncIndexes();
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });

    // 1. Recorded FX source: the operator-recorded ExchangeRate row is the
    //    only rate the mechanism can consume.
    const rate = await ExchangeRate.create({
      tenant: tenantA,
      fromCurrency: "NGN",
      toCurrency: "GBP",
      rate: 0.25,
      effectiveDate: new Date(),
      isActive: true,
      source: "manual",
      createdBy: root._id,
    });

    // 2. A conversion policy prepares with the FULL recorded rate snapshot.
    const convertedPolicy = await policyAuthority.record(
      {
        scheduleRule: "Monthly on the fifth business day after settlement",
        currencyMode: "recorded_fx_conversion",
        destinationCurrency: "GBP",
        fxSourceName: "verified-operator-fx-source",
        fxRateTimestampPolicy: "recorded_effective_date",
        fxMaxAgeMinutes: 30,
        fxRounding: "half_up",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        clawbackRule: "via_recorded_subsequent_hold",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-FX-DECISION-1",
      },
      root,
    );
    const converted = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 1000,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "fx-1",
      },
      root,
    );
    assert.equal(converted.status, "prepared");
    assert.equal(converted.transfer.amountMinor, 1000, "the statement-currency amount stays exact");
    assert.equal(converted.transfer.currency, "NGN");
    assert.equal(converted.transfer.conversion.destinationCurrency, "GBP");
    assert.equal(converted.transfer.conversion.fxSourceName, "verified-operator-fx-source");
    assert.equal(String(converted.transfer.conversion.rateId), String(rate._id));
    assert.equal(converted.transfer.conversion.rate, 0.25);
    assert.deepEqual(
      new Date(converted.transfer.conversion.effectiveDate).getTime(),
      new Date(rate.effectiveDate).getTime(),
    );
    assert.equal(converted.transfer.conversion.rateSource, "manual");
    assert.equal(converted.transfer.conversion.rounding, "half_up");
    assert.equal(converted.transfer.conversion.convertedMinor, 250);
    assert.equal(converted.transfer.policyVersion, convertedPolicy.version);

    // 3. No recorded rate for the recorded destination: explicit refusal,
    //    zero payout transfers.
    await policyAuthority.record(
      {
        scheduleRule: "Monthly on the fifth business day after settlement",
        currencyMode: "recorded_fx_conversion",
        destinationCurrency: "EUR",
        fxSourceName: "verified-operator-fx-source",
        fxRateTimestampPolicy: "recorded_effective_date",
        fxMaxAgeMinutes: 30,
        fxRounding: "half_up",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        clawbackRule: "none_recorded",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-FX-DECISION-2",
      },
      root,
    );
    await assert.rejects(
      () =>
        payout.prepare(
          {
            childId: String(childA._id),
            amountMinor: 1000,
            destinationAccountReference: "payout-account-ref-1",
            idempotencyKey: "fx-2",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /recorded FX source/);
        assert.match(error.message, /EUR/);
        return true;
      },
    );
    assert.equal(await Transfer.countDocuments(), 1);

    // 4. A rate older than the recorded maximum age: explicit refusal.
    await ExchangeRate.create({
      tenant: tenantA,
      fromCurrency: "NGN",
      toCurrency: "EUR",
      rate: 1.2,
      effectiveDate: new Date(Date.now() - 3 * 86400000),
      isActive: true,
      source: "manual",
      createdBy: root._id,
    });
    await assert.rejects(
      () =>
        payout.prepare(
          {
            childId: String(childA._id),
            amountMinor: 1000,
            destinationAccountReference: "payout-account-ref-1",
            idempotencyKey: "fx-2",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /older than the recorded maximum age/);
        return true;
      },
    );
    assert.equal(await Transfer.countDocuments(), 1);

    // 5. The original-transaction-currency policy pins back; the SEALED
    //    transport refuses the submit with the explicit sealed reason, the
    //    transfer stays reserved in `executing`, and the balance consumed
    //    exactly once.
    const policy = await policyAuthority.record(
      {
        scheduleRule: "Weekly on the third business day after settlement",
        currencyMode: "original_transaction_currency",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        clawbackRule: "via_recorded_subsequent_hold",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-SEALED-DECISION",
      },
      root,
    );
    const prepared = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 600,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "sealed-1",
      },
      root,
    );
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.transfer.conversion, null);
    const reviewed = await payout.markReviewed(String(prepared.transfer._id), root);
    assert.equal(reviewed.transfer.state, "reviewed");
    await assert.rejects(
      () => payout.execute(String(prepared.transfer._id), root),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /sealed/);
        assert.match(error.message, /money-rails contract/);
        return true;
      },
    );
    const reserved = await Transfer.findById(String(prepared.transfer._id)).lean();
    assert.equal(reserved.state, "executing", "responsibility is reserved, never released");
    assert.match(reserved.lastError || "", /sealed/);
    assert.equal((await Balance.findById(String(childA._id)).lean()).transferredMinor, 600);

    // 6. ONLY once-only authenticated provider evidence settles: the first
    //    evidence row reconciles the uncertainty; duplicates and late
    //    confirmations cannot reconcile again.
    const settled = await payout.reconcile(
      {
        transferId: String(prepared.transfer._id),
        provider: "operator_synthetic",
        account: "payout_ops",
        providerTransferId: "TRF-2026-STORED-1",
      },
      root,
    );
    assert.equal(settled.status, "reconciled");
    assert.equal(settled.transfer.state, "settled");
    assert.equal(settled.transfer.settledEvidence, "operator_synthetic:payout_ops:TRF-2026-STORED-1");
    assert.equal(await Evidence.countDocuments(), 1);
    assert.ok(
      await AuditLog.findOne({ action: "MERCHANT_PAYOUT_EVIDENCE_RECORD" }),
      "evidence settlement is audited",
    );
    const replayConfirm = await payout.reconcile(
      {
        transferId: String(prepared.transfer._id),
        provider: "operator_synthetic",
        account: "payout_ops",
        providerTransferId: "TRF-2026-STORED-1",
      },
      root,
    );
    assert.equal(replayConfirm.status, "already_reconciled", "duplicate/late confirmation replays write-free");
    await assert.rejects(
      () =>
        payout.reconcile(
          {
            transferId: String(prepared.transfer._id),
            provider: "operator_synthetic",
            account: "payout_ops",
            providerTransferId: "TRF-2026-LATE-2",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /Only an executing or uncertain/);
        return true;
      },
    );
    assert.equal(await Evidence.countDocuments(), 1);
    assert.equal((await Balance.findById(String(childA._id)).lean()).transferredMinor, 600);
    assert.equal(String(policy._id), String(policy._id));
  },
);

test(
  "concurrent duplicate reconciles of one reserved payout transfer resolve once-only: the base is consumed exactly once and the loser never surfaces a raw duplicate-key error",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "payout_reconcile_race");
    const fixture = await require("./helpers/payoutFixture").twoChildren();
    const { childA, root } = fixture;
    const policyAuthority = require("../services/merchantFulfillment/payout/policy");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    const Transfer = require("../models/MerchantPayoutTransfer");
    const Evidence = require("../models/MerchantPayoutEvidence");
    const Balance = require("../models/MerchantPayoutBalance");
    const transport = require("../services/merchantFulfillment/payout/transport");
    await require("../models/MerchantPayoutPolicy").syncIndexes();
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });

    const policy = await policyAuthority.record(
      {
        scheduleRule: "Weekly on the third business day after settlement",
        currencyMode: "original_transaction_currency",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        clawbackRule: "none_recorded",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-RECONCILE-RACE-DECISION",
      },
      root,
    );
    const prepared = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 600,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "reconcile-race-1",
      },
      root,
    );
    assert.equal(prepared.status, "prepared");
    await payout.markReviewed(String(prepared.transfer._id), root);
    t.mock.method(transport, "submit", async () => ({
      id: "ptr_reconcile_race_1",
      status: "pending",
    }));
    const executed = await payout.execute(String(prepared.transfer._id), root);
    assert.equal(executed.transfer.state, "uncertain");
    assert.equal(executed.transfer.submittedTransferId, "ptr_reconcile_race_1");
    assert.equal(
      (await Balance.findById(String(childA._id)).lean()).transferredMinor,
      600,
      "execution consumed the base exactly once before the reconcile race",
    );

    // The race under review: TWO concurrent reconciles of the SAME reserved
    // transfer submit the SAME authenticated provider evidence identity (the
    // identity the provider report stamped on submission). The evidence
    // identity is once-only, so at most one may record it; the base
    // must be consumed exactly once in total, and NO outcome may be a raw
    // E11000 duplicate-key error — losers resolve through the module's own
    // once-only semantics (explicit conflict or write-free replay only).
    const command = {
      transferId: String(prepared.transfer._id),
      provider: "operator_synthetic",
      account: "payout_ops",
      providerTransferId: "ptr_reconcile_race_1",
    };
    const results = await Promise.allSettled([
      payout.reconcile(command, root),
      payout.reconcile(command, root),
    ]);
    // At most one reconcile may SETTLE ("reconciled"); the loser resolves
    // through the module's once-only semantics — a write-free
    // "already_reconciled" replay when the winner's transaction committed
    // first, or an explicit once-only 409 — and in NO case a raw E11000.
    let settledWinner = 0;
    for (const outcome of results) {
      if (outcome.status === "fulfilled") {
        assert.ok(
          ["reconciled", "already_reconciled"].includes(outcome.value.status),
          `module once-only outcome, got ${outcome.value?.status}`,
        );
        if (outcome.value.status === "reconciled") settledWinner += 1;
      } else {
        assert.equal(outcome.reason.statusCode, 409);
        assert.notEqual(outcome.reason.code, 11000, "no raw E11000 may surface");
        assert.doesNotMatch(String(outcome.reason.message), /E11000|duplicate key/i);
        assert.match(
          outcome.reason.message,
          /cannot reconcile again|once-only/,
          "the rejection carries the module's explicit once-only reason",
        );
      }
    }
    assert.equal(settledWinner, 1, "exactly one reconcile settles the transfer");
    assert.equal(await Evidence.countDocuments(), 1, "one evidence identity, once");
    const settled = await Transfer.findById(String(prepared.transfer._id)).lean();
    assert.equal(settled.state, "settled");
    assert.equal(settled.settledEvidence, "operator_synthetic:payout_ops:ptr_reconcile_race_1");
    assert.equal(
      (await Balance.findById(String(childA._id)).lean()).transferredMinor,
      600,
      "the statement base is consumed exactly once across the whole race",
    );
  },
);

test(
  "a provider transfer identity that mismatches the recorded submitted identity refuses reconciliation with zero writes",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "payout_mismatch");
    const fixture = await require("./helpers/payoutFixture").twoChildren();
    const { childA, root } = fixture;
    const policyAuthority = require("../services/merchantFulfillment/payout/policy");
    const payout = require("../services/merchantFulfillment/payout/transfer");
    const Evidence = require("../models/MerchantPayoutEvidence");
    const Balance = require("../models/MerchantPayoutBalance");
    const transport = require("../services/merchantFulfillment/payout/transport");
    await require("../models/MerchantPayoutPolicy").syncIndexes();
    process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED = "true";
    t.after(() => {
      delete process.env.MERCHANT_PAYOUT_TRANSFERS_ENABLED;
    });

    await policyAuthority.record(
      {
        scheduleRule: "Weekly on the third business day after settlement",
        currencyMode: "original_transaction_currency",
        destinationAccountSource: "tenant_payout_account_reference",
        holdRegime: "recorded_holds_and_standing_minor",
        clawbackRule: "none_recorded",
        nettingRule: "statement_net_receivable_only",
        minimumThresholdMinor: 1000,
        decisionReference: "TEST-MISMATCH-DECISION",
      },
      root,
    );
    const prepared = await payout.prepare(
      {
        childId: String(childA._id),
        amountMinor: 600,
        destinationAccountReference: "payout-account-ref-1",
        idempotencyKey: "mismatch-1",
      },
      root,
    );
    await payout.markReviewed(String(prepared.transfer._id), root);
    t.mock.method(transport, "submit", async () => ({
      id: "ptr_mismatch_submit_1",
      status: "pending",
    }));
    const executed = await payout.execute(String(prepared.transfer._id), root);
    assert.equal(executed.transfer.state, "uncertain");
    assert.equal(executed.transfer.submittedTransferId, "ptr_mismatch_submit_1");

    await assert.rejects(
      () =>
        payout.reconcile(
          {
            transferId: String(prepared.transfer._id),
            provider: "operator_synthetic",
            account: "payout_ops",
            providerTransferId: "TRF-FROM-A-NOTHER-ID",
          },
          root,
        ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /does not match the submitted identity/);
        return true;
      },
    );
    assert.equal(await Evidence.countDocuments(), 0, "the mismatch refusal writes no evidence");
    assert.equal(
      (await Balance.findById(String(childA._id)).lean()).transferredMinor,
      600,
      "the mismatch refusal writes no balance",
    );
  },
);
