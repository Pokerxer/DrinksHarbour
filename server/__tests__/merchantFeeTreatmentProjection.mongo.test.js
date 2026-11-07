"use strict";
// Fee-treatment PROJECTION (workstream Fb) — a PURE RECORD projection of the
// recorded provider fee bearer / treatment authority. No fee journal exists in
// the marketplace path and historical fees stay unknown forever: the
// projection surfaces recorded decisions verbatim (data only), states
// unrecorded flows fail-closed as "not recorded", refuses to output ANY
// historical fee figure, and never measures, backfills or infers.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const FLOW_FILE = "merchantsFeeTreatmentProjection".length; // marker only
const projectionPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/feeTreatment/projection.js",
);
const viewPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/feeTreatment/statementFeeView.js",
);
const authorityPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/feeTreatment/policy.js",
);
const Policy = require("../models/MerchantFeeTreatmentPolicy");
const ws = require("../services/merchantFulfillment/feeTreatment");
const statement = require("../services/merchantFulfillment/settlement/statement");

const FLOWS = [
  "merchandise_refund",
  "shipping_refund",
  "carrier_recovery",
  "stored_value_refund",
  "kora_refund",
  "payout",
];

test(
  "fee projection fails closed: every unrecorded flow states not-recorded and no fee figure",
  { skip: !uri || !FLOW_FILE },
  async (t) => {
    assert.ok(fs.existsSync(projectionPath), "projection module exists");
    await connectVenueMongo(t, "fee_treatment_projection");
    const view = await ws.projection.projectView();
    assert.equal(view.projectionVersion, 1);
    assert.match(view.note, /recorded-not-measured/);
    // Discovered accounting fact surfaced: the marketplace posting set has no
    // provider-fee account at all.
    assert.equal(view.accounting.feeAccountExists, false);
    assert.match(view.accounting.note, /no provider-fee account|no fee account/i);
    for (const flow of FLOWS) {
      const row = view.flows.find((entry) => entry.flow === flow);
      assert.ok(row, `flow ${flow} is projected`);
      assert.equal(row.state, "not_recorded");
      assert.equal(row.bearer, null);
      assert.equal(row.decisionReference, null);
      assert.match(row.reason, /not recorded/i);
      assert.equal(row.historical.state, "stays_unknown");
      assert.match(row.historical.reason, /unknown/);
      assert.equal(row.historical.figures, "none");
    }
    // The projection refuses fee figures: no minor-amount field may exist for
    // historical fees anywhere in the output.
    assert.doesNotMatch(JSON.stringify(view), /Minor/);
    // Per-flow explicit read settles the same way.
    const one = await ws.projection.forFlow("merchandise_refund");
    assert.equal(one.state, "not_recorded");
    assert.equal(one.policyVersion, null);
  },
);

test(
  "fee projection surfaces recorded bearer/treatment verbatim; historical rule stays unknown or flagged, never a figure",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(authorityPath), "policy authority service exists");
    await connectVenueMongo(t, "fee_treatment_projection");
    const authority = require("../services/merchantFulfillment/feeTreatment/policy");
    const root = { _id: new mongoose.Types.ObjectId(), role: "super_admin" };

    // v1: merchandise + shipping refund flows, none_recorded historical rule,
    // with an operator wording the projection must surface byte-exact.
    const wording = "SYNTHETIC-COMMITTEE-DECISION: refund provider fees stay behind the platform share unless the committee records otherwise. v1 WORDING [DO NOT PARAPHRASE]";
    await authority.record(
      {
        flows: ["merchandise_refund", "shipping_refund"],
        bearer: "customer_refund_share",
        futureJournalTreatment: "no_provider_fee_journal_until_fee_account_exists",
        historicalFeeRule: "none_recorded_stays_unknown",
        decisionReference: wording,
      },
      root,
    );

    const view = await ws.projection.projectView();
    const merchandise = view.flows.find((row) => row.flow === "merchandise_refund");
    assert.equal(merchandise.state, "recorded");
    assert.equal(merchandise.bearer, "customer_refund_share");
    assert.equal(merchandise.policyVersion, 1);
    assert.equal(merchandise.futureJournalTreatment, "no_provider_fee_journal_until_fee_account_exists");
    assert.equal(merchandise.historical.rule, "none_recorded_stays_unknown");
    assert.equal(merchandise.historical.state, "stays_unknown");
    // Byte-exact recorded wording surfaced verbatim.
    assert.equal(merchandise.decisionReference, wording);
    const shipping = view.flows.find((row) => row.flow === "shipping_refund");
    assert.equal(shipping.state, "recorded");
    assert.equal(shipping.bearer, "customer_refund_share");
    // Per-flow completeness is NOT required: unrecorded flows stay fail-closed.
    for (const flow of FLOWS.filter(
      (f) => f !== "merchandise_refund" && f !== "shipping_refund",
    )) {
      const row = view.flows.find((entry) => entry.flow === flow);
      assert.equal(row.state, "not_recorded");
      assert.equal(row.bearer, null);
    }
    assert.doesNotMatch(JSON.stringify(view), /Minor/);

    // v2: payout flow with a recordable-but-unexecutable historical rule —
    // recorded verbatim, flagged as requiring a future measurement mechanism,
    // and STILL never carrying a historical fee figure.
    await authority.record(
      {
        flows: ["payout"],
        bearer: "merchant_bears",
        futureJournalTreatment: "future_provider_fee_expense_journal_required",
        historicalFeeRule: "historical_fees_unrecorded_requires_measurement",
        decisionReference: "SYNTHETIC-FEE-DECISION-2",
      },
      root,
    );
    const after = await ws.projection.projectView();
    const payout = after.flows.find((row) => row.flow === "payout");
    assert.equal(payout.state, "recorded");
    assert.equal(payout.policyVersion, 2);
    assert.equal(payout.bearer, "merchant_bears");
    assert.equal(payout.historical.rule, "historical_fees_unrecorded_requires_measurement");
    assert.equal(payout.historical.state, "requires_measurement_mechanism");
    assert.match(payout.historical.reason, /measurement/i);
    assert.equal(payout.historical.figures, "none");
    assert.doesNotMatch(JSON.stringify(after), /Minor/);
    // forFlow import point resolves the newest governing version per flow.
    const payoutOne = await ws.projection.forFlow("payout");
    assert.equal(payoutOne.bearer, "merchant_bears");
    assert.equal((await ws.projection.forFlow("shipping_refund")).policyVersion, 1);
  },
);

test(
  "statementFeeView composes the read-only settlement statement with the fee projection additively",
  { skip: !uri },
  async (t) => {
    assert.ok(fs.existsSync(viewPath), "statementFeeView sibling module exists");
    assert.equal(ws.statementFeeView.ADDITIVE, true, "documented as additive");
    await connectVenueMongo(t, "fee_treatment_view");
    const oid = () => new mongoose.Types.ObjectId(),
      Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Set = require("../models/MerchantOrderSet"),
      Journal = require("../models/JournalEntry");
    const root = { _id: oid(), role: "super_admin" },
      buyer = oid(),
      tenantA = oid(),
      merchantA = { _id: oid(), role: "tenant_owner", tenant: tenantA };
    const parent = oid();
    const items = [
      {
        _id: oid(),
        tenant: tenantA,
        warehouse: oid(),
        product: oid(),
        subproduct: oid(),
        size: oid(),
        quantity: 1,
        itemSubtotal: 20,
        discountAmount: 0,
        tenantRevenueShare: 16,
        platformCommission: 4,
      },
    ];
    const order = {
      _id: parent,
      user: buyer,
      currency: "NGN",
      subtotal: 20,
      totalAmount: 20,
      shippingFee: 0,
      taxAmount: 0,
      discountTotal: 0,
      paymentStatus: "paid",
      status: "confirmed",
      paymentMethod: "card",
      merchantFulfillmentVersion: 1,
      source: "web",
      settlementOwner: "platform",
      items,
    };
    await Order.collection.insertOne(order);
    await Child.create(require("../services/merchantFulfillment/allocation").allocate(order));
    await Set.create({
      _id: parent,
      currency: "NGN",
      totalMinor: 2000,
      children: (await Child.find({ order: parent }).lean()).map((g) => g._id),
      allocationPolicy: "merchandise-weighted-v1",
    });
    await require("../services/chartOfAccounts.service").ensureDefaultCOA(tenantA);
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenantA,
      refDoc: parent,
      refDocType: "Order",
      entryType: "sales_revenue",
      source: "marketplace",
      lines: [
        { account: "1300", debit: 16, credit: 0 },
        { account: "6500", debit: 4, credit: 0 },
        { account: "4000", debit: 0, credit: 20 },
      ],
    });
    const childId = String((await Child.findOne({ order: parent }).lean())._id);
    const journalsBefore = await Journal.countDocuments();
    const policiesBefore = await Policy.countDocuments();

    const view = await ws.statementFeeView.child(childId, merchantA);
    // The statement part is UNMODIFIED: byte-identical to the direct read.
    const direct = await statement.child(childId, merchantA);
    const { feeTreatment, ...statementPart } = view;
    assert.equal(JSON.stringify(statementPart), JSON.stringify(direct));
    assert.equal(view.statementVersion, 1);
    assert.equal(view.totals.merchandiseMinor, 2000);
    // The fee treatment is the additive sibling section — equal to the
    // projection's exact operator view.
    const projectionView = await ws.projection.projectView();
    assert.deepEqual(view.feeTreatment.flows, projectionView.flows);
    assert.equal(view.feeTreatment.additive, true);
    // Pure reads only.
    assert.equal(await Journal.countDocuments(), journalsBefore);
    assert.equal(await Policy.countDocuments(), policiesBefore);
    // Foreign tenant denial mirrors the statement's own scoping.
    await assert.rejects(
      () =>
        ws.statementFeeView.child(childId, {
          _id: oid(),
          role: "tenant_owner",
          tenant: oid(),
        }),
      (error) => error instanceof require("../utils/errors").NotFoundError,
    );
  },
);
