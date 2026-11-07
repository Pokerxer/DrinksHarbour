"use strict";
// Platform-ops mechanisms queue — real replica. Read-only kora/payout
// reservation states (K + P reserved states); no mutation route; role
// denial; zero-write double reads; readiness counts.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { connectVenueMongo } = require("./helpers/venueMongo");
const KORA_ISSUE = "Synthetic kora transport unknown outcome; reconcile once by provider refund id";
const KORA_REQUESTED_WORDING =
  "Kora refund reservation is committed and awaits the provider outcome or operator reconciliation.";
const KORA_AMBIGUOUS_DEFAULT =
  "Provider refund outcome requires reconciliation; do not resubmit";
const PAYOUT_EXECUTING_WORDING =
  "Payout transfer reservation is claimed by its executing state; responsibility is never released without evidence.";
const PAYOUT_UNCERTAIN_WORDING =
  "Awaiting once-only authenticated provider transfer evidence; a provider report never becomes a financial fact.";
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
async function mount(t) {
  const express = require("express"), jwt = require("jsonwebtoken");
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "synthetic-platform-ops-mechqueue";
  t.after(() =>
    previous === undefined
      ? delete process.env.JWT_SECRET
      : (process.env.JWT_SECRET = previous)
  );
  const app = express();
  app.use(express.json());
  app.use("/platform-ops", require("../routes/platformOps.routes"));
  app.use((err, _req, res, _next) =>
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
    try { parsed = JSON.parse(text); } catch { parsed = { message: text }; }
    return { status: r.status, body: parsed };
  };
  return { call };
}

async function users() {
  const User = require("../models/User");
  const rows = ["super_admin", "admin", "tenant_owner", "customer"].map((role) => ({
    _id: new mongoose.Types.ObjectId(),
    email: `${role}@example.test`, role, status: "active",
  }));
  await User.collection.insertMany(rows);
  return Object.fromEntries(rows.map((row) => [row.role, row]));
}

async function insertRows() {
  const oid = () => new mongoose.Types.ObjectId();
  const Kora = require("../models/MerchantKoraRefundAllocation");
  const Transfer = require("../models/MerchantPayoutTransfer");
  const tenant = oid(),
    creator = oid();
  const orders = { uncertain: oid(), requested: oid(), settled: oid() };
  const children = { executing: sha("child-executing"), uncertain: sha("child-uncertain") };
  await Kora.create([
    {
      _id: sha("kora-refund:claim-ops:uncertain"),
      order: orders.uncertain,
      claim: "korapay:platform:synth-uncertain",
      provider: "korapay",
      account: "platform",
      providerReference: "synth-uncertain",
      fallbackAccepted: false,
      receiptTransactionId: "918776",
      customer: creator,
      currency: "NGN",
      amountMinor: 500,
      claimAmountMinor: 2000,
      policyId: oid(),
      policyVersion: 1,
      feeBearerState: "not_applicable",
      state: "uncertain",
      issue: KORA_ISSUE,
      providerRefundId: "KRF-UNKNOWN-OPS",
      remainderMinorAfter: 1500,
    },
    {
      _id: sha("kora-refund:claim-ops:requested"),
      order: orders.requested,
      claim: "korapay:platform:synth-requested",
      provider: "korapay",
      account: "platform",
      providerReference: "synth-requested",
      fallbackAccepted: true,
      customer: creator,
      currency: "NGN",
      amountMinor: 300,
      claimAmountMinor: 900,
      policyId: oid(),
      policyVersion: 1,
      feeBearerState: "not_applicable",
      state: "requested",
      remainderMinorAfter: 600,
    },
    {
      _id: sha("kora-refund:claim-ops:settled"),
      order: orders.settled,
      claim: "korapay:platform:synth-settled",
      provider: "korapay",
      account: "platform",
      providerReference: "synth-settled",
      fallbackAccepted: false,
      customer: creator,
      currency: "NGN",
      amountMinor: 100,
      claimAmountMinor: 1000,
      policyId: oid(),
      policyVersion: 1,
      feeBearerState: "not_applicable",
      state: "settled",
      remainderMinorAfter: 900,
      processedAt: new Date(),
    },
  ]);
  await Transfer.create([
    {
      _id: sha("merchant-payout-transfer:child-executing:ops-key"),
      child: children.executing,
      order: oid(),
      tenant,
      currency: "NGN",
      amountMinor: 400,
      destinationAccountReference: "synthetic-account-ref-display-only",
      statementVersion: 1,
      netReceivableMinor: 1600,
      heldTotalMinor: 500,
      transferableBaseMinor: 1100,
      policyVersion: 1,
      createdBy: creator,
      state: "executing",
      lastError:
        "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).",
      lastErrorAt: new Date(),
    },
    {
      _id: sha("merchant-payout-transfer:child-uncertain:ops-key"),
      child: children.uncertain,
      order: oid(),
      tenant,
      currency: "NGN",
      amountMinor: 300,
      destinationAccountReference: "synthetic-account-ref-display-only",
      statementVersion: 1,
      netReceivableMinor: 1600,
      heldTotalMinor: 500,
      transferableBaseMinor: 1100,
      policyVersion: 1,
      createdBy: creator,
      state: "uncertain",
      submittedTransferId: "TRF-OPS-2026-1",
    },
    {
      _id: sha("merchant-payout-transfer:child-reviewed:ops-key"),
      child: sha("child-reviewed"),
      order: oid(),
      tenant,
      currency: "NGN",
      amountMinor: 200,
      destinationAccountReference: "synthetic-account-ref-display-only",
      statementVersion: 1,
      netReceivableMinor: 700,
      heldTotalMinor: 0,
      transferableBaseMinor: 700,
      policyVersion: 1,
      createdBy: creator,
      state: "reviewed",
    },
    {
      _id: sha("merchant-payout-transfer:child-settled:ops-key"),
      child: sha("child-settled"),
      order: oid(),
      tenant,
      currency: "NGN",
      amountMinor: 100,
      destinationAccountReference: "synthetic-account-ref-display-only",
      statementVersion: 1,
      netReceivableMinor: 700,
      heldTotalMinor: 0,
      transferableBaseMinor: 700,
      policyVersion: 1,
      createdBy: creator,
      state: "settled",
      settledEvidence: "synthetic:ops:TRF-SETTLED-1",
    },
  ]);
  return { tenant, creator, orders, children };
}

test("mechanisms queue lists reservations with verbatim recorded issues and denies tenant roles", async (t) => {
  await connectVenueMongo(t, "ops_mechqueue");
  const people = await users();
  const mounted = await mount(t);
  await insertRows();
  people.call = mounted.call;
  // Kora list: settled excluded; verbatim recorded issue on uncertain.
  const kora = await people.call(people.super_admin, "GET", "/mechanism-exceptions?kind=kora_refund");
  assert.equal(kora.status, 200);
  assert.equal(kora.body.data.mechanismQueueVersion, 1);
  assert.equal(kora.body.data.kind, "kora_refund");
  assert.equal(kora.body.data.total, 2);
  assert.deepEqual(
    kora.body.data.entries.map((entry) => entry.state).sort(),
    ["requested", "uncertain"]
  );
  const uncertain = kora.body.data.entries.find((entry) => entry.state === "uncertain");
  assert.equal(uncertain.issue, KORA_ISSUE);
  assert.equal(uncertain.reason, KORA_ISSUE);
  const requested = kora.body.data.entries.find((entry) => entry.state === "requested");
  assert.equal(requested.reason, KORA_REQUESTED_WORDING);
  assert.equal(kora.body.data.entries.every((entry) => !("claim" in entry)), true, "claim identity stays out of list entries");

  // Payout kind — reviewed/settled excluded; recorded lastError surfaces verbatim.
  const payout = await people.call(people.super_admin, "GET", "/mechanism-exceptions?kind=payout_transfer");
  assert.equal(payout.body.data.total, 2);
  const executing = payout.body.data.entries.find((entry) => entry.state === "executing");
  assert.equal(
    executing.reason,
    "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate)."
  );
  const payoutUncertain = payout.body.data.entries.find((entry) => entry.state === "uncertain");
  assert.equal(payoutUncertain.reason, PAYOUT_UNCERTAIN_WORDING);
  assert.equal(
    payout.body.data.entries.every(
      (entry) =>
        !("destinationAccountReference" in entry) && !("submittedTransferId" in entry)
    ),
    true,
    "no account references or provider identities in list entries"
  );

  // Detail: whitelisted identities, empty audit, no mutation control.
  const detail = await people.call(people.super_admin, "GET",
    `/mechanism-exceptions/kora_refund/${encodeURIComponent(uncertain._id)}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.claim, "korapay:platform:synth-uncertain");
  assert.equal(detail.body.data.providerRefundId, "KRF-UNKNOWN-OPS");
  assert.equal(detail.body.data.remainderMinorAfter, 1500);
  assert.deepEqual(detail.body.data.audit, []);
  assert.equal(detail.body.data.reconcile.supported, false);
  assert.ok(detail.body.data.reconcile.reason.includes("service-level"));
  // Zero-write idempotency: double reads JSON-identical; rows unchanged.
  const second = await people.call(people.super_admin, "GET", "/mechanism-exceptions?kind=kora_refund");
  assert.equal(JSON.stringify(second.body.data), JSON.stringify(kora.body.data));
  const KoraState = require("../models/MerchantKoraRefundAllocation");
  assert.deepEqual(
    [
      await KoraState.countDocuments({}),
      await require("../models/MerchantKoraRefundEvidence").countDocuments({}),
      await require("../models/MerchantPayoutEvidence").countDocuments({}),
    ],
    [3, 0, 0]
  );

  // Role denial: tenant_owner/customer 403; admin admitted (platform roles).
  for (const [role, status] of [["tenant_owner", 403], ["customer", 403], ["admin", 200]]) {
    const response = await people.call(people[role], "GET", "/mechanism-exceptions?kind=payout_transfer");
    assert.equal(response.status, status, `${role} → ${status}`);
  }
  const queue = require("../services/operations/mechanismsQueue");
  for (const role of ["tenant_owner", "customer"])
    await assert.rejects(queue.list({ role }, { kind: "kora_refund" }), (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    });
});

test("readiness surfaces the mechanisms' unresolved reservation counts", async (t) => {
  await connectVenueMongo(t, "ops_mechqueue_counts");
  const people = await users();
  await insertRows();
  const readiness = require("../services/operations/readiness");
  const snapshot = await readiness.snapshot({ _id: people.super_admin._id, role: "super_admin" });
  assert.equal(snapshot.mechanisms.koraRefund.unresolvedReservations, 2);
  assert.equal(snapshot.mechanisms.payoutTransfer.unresolvedTransfers, 2);
  assert.equal(snapshot.mechanisms.koraRefund.state, "none_recorded");
  assert.equal(
    snapshot.mechanisms.koraRefund.reason,
    "Original tender refund capability requires review."
  );
  assert.equal(snapshot.mechanisms.payoutTransfer.reason,
    "No payout execution exists; payout policy requires review.");
});
