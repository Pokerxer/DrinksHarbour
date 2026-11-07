"use strict";
// Original-source stored-value refund credit command (workstream W) — wallet
// paths: fail-closed gates, once-only idempotent credit, remainder
// conservation across multi-refunds, redeemedAtTenant reconciliation.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const { walletCheckoutFixture, recordPolicy, oid } = require("./helpers/storedValueRefundFixture");

const creditPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/refundSources/storedValueCredit.js",
);
const storedValueCredit = require(creditPath);
const TENDER_REVIEW = "Original tender refund capability requires review.";
const FLAG = "MERCHANT_STORED_VALUE_REFUNDS_ENABLED";

test(
  "stored-value credit re-credits the original wallet once-only with exact remainder conservation",
  { skip: !uri },
  async (t) => {
    assert.ok(
      require("node:fs").existsSync(creditPath),
      "storedValueCredit command module exists",
    );
    await connectVenueMongo(t, "stored_value_credit_wallet");
    const User = require("../models/User"),
      WalletTransaction = require("../models/PlatformWalletTransaction"),
      CreditRecord = require("../models/StoredValueRefundCredit");
    const root = { _id: oid(), role: "super_admin" };
    const tenant = oid();
    const counts = async () => ({
      credits: await CreditRecord.countDocuments(),
      refunds: await WalletTransaction.countDocuments({ type: "refund" }),
    });

    // --- Fail-closed default: no flag, no recorded policy → zero writes. ---
    const gated = await walletCheckoutFixture({});
    delete process.env[FLAG];
    await assert.rejects(
      () =>
        storedValueCredit.creditStoredValue(
          { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "gated-1" },
          root,
        ),
      (error) => error.statusCode === 409 && error.message === TENDER_REVIEW,
    );
    assert.deepEqual(await counts(), { credits: 0, refunds: 0 });
    assert.equal((await User.findById(gated.buyer).lean()).platformWalletBalance, 0);

    // --- Flag on but no recorded policy → same explicit unsupported. ---
    process.env[FLAG] = "true";
    t.after(() => delete process.env[FLAG]);
    await assert.rejects(
      () =>
        storedValueCredit.creditStoredValue(
          { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "gated-2" },
          root,
        ),
      (error) => error.statusCode === 409 && error.message === TENDER_REVIEW,
    );
    assert.deepEqual(await counts(), { credits: 0, refunds: 0 });

    // --- Tenant actors are denied the platform stored-value credit. ---
    await assert.rejects(
      () =>
        storedValueCredit.creditStoredValue(
          { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "gated-3" },
          { _id: oid(), role: "tenant_owner", tenant },
        ),
      (error) => error.statusCode === 403,
    );
    assert.deepEqual(await counts(), { credits: 0, refunds: 0 });

    // --- Recorded policy + flag → wallet credit to the SAME object. ---
    const policy = await recordPolicy("wallet");
    const result = await storedValueCredit.creditStoredValue(
      { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "credit-1" },
      root,
    );
    assert.equal(result.status, "credited");
    assert.equal(result.kind, "wallet");
    assert.equal(result.destination.type, "wallet_user");
    assert.equal(String(result.destination.id), String(gated.buyer));
    assert.equal(result.amountMinor, 500);
    assert.equal(result.currency, "NGN");
    assert.equal(String(result.originalDebit.id), gated.debitTxId);
    assert.equal(result.originalDebit.amountMinor, 500);
    // Wallet funding linkage is honest-by-absence, surfaced verbatim.
    assert.equal(result.originalDebit.funding.status, "not_recorded");
    assert.equal(
      result.originalDebit.funding.reason,
      "Wallet checkout debits do not record a single funding identity; funding resolution requires the customer funding reference.",
    );
    assert.equal(result.remainderMinor, 0);
    assert.equal(result.policy.version, policy.version);
    assert.equal(result.reconciliation.state, "not_applicable");
    assert.equal(
      (await User.findById(gated.buyer).lean()).platformWalletBalance,
      5,
    );
    assert.deepEqual(await counts(), { credits: 1, refunds: 1 });
    const row = await WalletTransaction.findOne({ type: "refund" }).lean();
    assert.equal(row.amount, 5);
    assert.equal(row.balanceAfter, 5);
    assert.equal(row.source, "refund");
    assert.equal(row.reference, gated.debitTxId);
    assert.equal(String(row.relatedOrder), String(gated.orderId));
    const record = await CreditRecord.findOne({}).lean();
    assert.equal(String(record.debitTransaction), gated.debitTxId);
    assert.equal(record.amountMinor, 500);
    assert.equal(record.state, "credited");
    assert.equal(record.policyVersion, policy.version);

    // --- Sequential replay: same key → already_credited, zero new writes. ---
    const replay = await storedValueCredit.creditStoredValue(
      { orderId: gated.orderId, amountMinor: 500, idempotencyKey: "credit-1" },
      root,
    );
    assert.equal(replay.status, "already_credited");
    assert.equal(String(replay.ledger.id), String(result.ledger.id));
    assert.equal(replay.amountMinor, 500);
    assert.equal(
      (await User.findById(gated.buyer).lean()).platformWalletBalance,
      5,
    );
    assert.deepEqual(await counts(), { credits: 1, refunds: 1 });

    // --- Remainder conservation across partial refunds. ---
    const partial = await walletCheckoutFixture({ amountNaira: 5 });
    const first = await storedValueCredit.creditStoredValue(
      { orderId: partial.orderId, amountMinor: 200, idempotencyKey: "part-1" },
      root,
    );
    assert.equal(first.remainderMinor, 300);
    const second = await storedValueCredit.creditStoredValue(
      { orderId: partial.orderId, amountMinor: 300, idempotencyKey: "part-2" },
      root,
    );
    assert.equal(second.remainderMinor, 0);
    await assert.rejects(
      () =>
        storedValueCredit.creditStoredValue(
          { orderId: partial.orderId, amountMinor: 100, idempotencyKey: "part-3" },
          root,
        ),
      /remaining refundable balance/i,
    );
    assert.equal(
      (await User.findById(partial.buyer).lean()).platformWalletBalance,
      5,
    );
    assert.deepEqual(await counts(), { credits: 3, refunds: 3 });

    // --- Concurrent duplicates both resolve with exactly one ledger write. ---
    const concurrent = await walletCheckoutFixture({ amountNaira: 3 });
    const both = await Promise.all([
      storedValueCredit.creditStoredValue(
        { orderId: concurrent.orderId, amountMinor: 300, idempotencyKey: "race-1" },
        root,
      ),
      storedValueCredit.creditStoredValue(
        { orderId: concurrent.orderId, amountMinor: 300, idempotencyKey: "race-1" },
        root,
      ),
    ]);
    const statuses = both.map((r) => r.status).sort();
    assert.deepEqual(statuses, ["already_credited", "credited"]);
    assert.equal(String(both[0].ledger.id), String(both[1].ledger.id));
    assert.equal(both[0].amountMinor, both[1].amountMinor);
    assert.equal(
      (await User.findById(concurrent.buyer).lean()).platformWalletBalance,
      3,
    );
    assert.deepEqual(await counts(), { credits: 4, refunds: 4 });
    const raceRecord = await CreditRecord.findOne({
      debitTransaction: concurrent.debitTxId,
    }).lean();
    assert.equal(raceRecord.amountMinor, 300);

    // --- Reconciliation against the platform→tenant settlement (Q5d). ---
    const settled = await walletCheckoutFixture({ amountNaira: 2, redeemedAtTenant: tenant });
    const reconciled = await storedValueCredit.creditStoredValue(
      { orderId: settled.orderId, amountMinor: 200, idempotencyKey: "recon-1" },
      root,
    );
    assert.equal(reconciled.reconciliation.state, "recorded");
    assert.equal(String(reconciled.reconciliation.tenant), String(tenant));
    const reconRow = await WalletTransaction.findOne({
      reference: settled.debitTxId,
      type: "refund",
    }).lean();
    assert.equal(String(reconRow.redeemedAtTenant), String(tenant));
  },
);
