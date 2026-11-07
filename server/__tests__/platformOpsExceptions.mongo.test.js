"use strict";
// Platform operations exceptions & readiness — real JWT/Mongo regression.
// Covers: queue filtering per kind, merchant-role denial, zero-write
// idempotency, the wired refundSources/discovery helpers in refund inspect
// detail, read-only audit history, readiness snapshot and the two pre-existing
// reconcile controls (refund processed-retrieval settle, carrier
// reconciliation by known original provider ID). Synthetic records only.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");

const RETURN_EFFECTS_UNSUPPORTED =
  "Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported";
const READY_NOTICE = "Readiness evidence is not activation permission.";

const sha = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function mount(t) {
  const express = require("express"),
    jwt = require("jsonwebtoken");
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "synthetic-platform-ops-only";
  t.after(() =>
    previous === undefined
      ? delete process.env.JWT_SECRET
      : (process.env.JWT_SECRET = previous)
  );
  const app = express();
  app.use(express.json());
  app.use("/platform-ops", require("../routes/platformOps.routes"));
  app.use((err, req, res, next) =>
    res.status(err.statusCode || 500).json({ message: err.message })
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = (who) =>
    jwt.sign({ userId: String(who._id) }, process.env.JWT_SECRET);
  const call = async (who, method, path, body) => {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/platform-ops${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token(who)}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    );
    const text = await r.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
    return { status: r.status, body: parsed };
  };
  return { call };
}

async function users(t) {
  const oid = () => new mongoose.Types.ObjectId();
  const root = { _id: oid(), role: "super_admin" },
    owner = { _id: oid(), role: "tenant_owner", tenant: oid() },
    staff = { _id: oid(), role: "tenant_staff", tenant: owner.tenant },
    customer = { _id: oid(), role: "customer" };
  await require("../models/User").collection.insertMany([
    { _id: root._id, email: "root@example.test", role: "super_admin", status: "active" },
    { _id: owner._id, email: "owner@example.test", role: "tenant_owner", status: "active", tenant: owner.tenant },
    { _id: staff._id, email: "staff@example.test", role: "tenant_staff", status: "active", tenant: staff.tenant },
    { _id: customer._id, email: "customer@example.test", role: "customer", status: "active" },
  ]);
  return { root, owner, staff, customer, tenantA: owner.tenant };
}

function paidOrder(user) {
  return {
    user,
    currency: "NGN",
    paymentStatus: "paid",
    status: "confirmed",
    source: "web",
    settlementOwner: "platform",
    merchantFulfillmentVersion: 1,
  };
}

async function insertClaims() {
  const oid = () => new mongoose.Types.ObjectId(),
    buyer = oid();
  const Order = require("../models/Order"),
    Claim = require("../models/MarketplacePaymentClaim"),
    GiftTransaction = require("../models/GiftCardTransaction"),
    CheckoutDebit = require("../models/CheckoutDebit"),
    Funding = require("../models/StoredValueFunding");
  const paystackOrder = oid(),
    korapayOrder = oid(),
    noClaimOrder = oid(),
    giftOrder = oid(),
    giftCardId = oid();
  await Order.collection.insertMany([
    { _id: paystackOrder, ...paidOrder(buyer) },
    { _id: korapayOrder, ...paidOrder(buyer) },
    { _id: noClaimOrder, ...paidOrder(buyer) },
    { _id: giftOrder, ...paidOrder(buyer) },
  ]);
  await Claim.create({
    _id: "paystack:platform:dhm-payref-ops",
    provider: "paystack",
    account: "platform",
    reference: "dhm-payref-ops",
    user: buyer,
    amount: 20,
    currency: "NGN",
    state: "allocated",
    order: paystackOrder,
    receipt: {
      method: "paystack",
      reference: "dhm-payref-ops",
      transactionId: "918273",
      amount: 20,
      currency: "NGN",
      paidAt: new Date(),
    },
  });
  await Claim.create({
    _id: "korapay:platform:dhm-korafallback-ops",
    provider: "korapay",
    account: "platform",
    reference: "dhm-korafallback-ops",
    user: buyer,
    amount: 20,
    currency: "NGN",
    state: "allocated",
    order: korapayOrder,
    receipt: {
      method: "korapay",
      reference: "dhm-korafallback-ops",
      transactionId: "dhm-korafallback-ops",
      amount: 20,
      currency: "NGN",
      paidAt: new Date(),
    },
  });
  const giftTx = await GiftTransaction.create({
    giftCardId,
    type: "redeem",
    amount: 5,
    balanceAfter: 0,
    checkoutReceipt: true,
    relatedOrder: null,
    createdBy: buyer,
  });
  await CheckoutDebit.create({
    _id: sha(`${buyer}:gift-req-ops`),
    user: buyer,
    method: "gift_card",
    transaction: giftTx._id,
  });
  await Funding.create({
    _id: "paystack:platform:dhm-giftfund-ops",
    provider: "paystack",
    reference: "dhm-giftfund-ops",
    user: buyer,
    amount: 5,
    currency: "NGN",
    kind: "gift_card_purchase",
    target: giftCardId,
    state: "credited",
  });
  await Claim.create({
    _id: `gift_card:platform:${giftTx._id}`,
    provider: "gift_card",
    account: "platform",
    reference: String(giftTx._id),
    user: buyer,
    amount: 5,
    currency: "NGN",
    state: "allocated",
    order: giftOrder,
    receipt: {
      method: "gift_card",
      reference: String(giftTx._id),
      transactionId: String(giftTx._id),
      amount: 5,
      currency: "NGN",
      paidAt: new Date(),
    },
  });
  return { buyer, paystackOrder, korapayOrder, noClaimOrder, giftOrder, giftCardId };
}

async function insertRefunds(claims, tenantA) {
  const oid = () => new mongoose.Types.ObjectId();
  const Refund = require("../models/MerchantRefundAllocation");
  const base = (order, reference, receipt, provider) => ({
    order,
    tenant: tenantA,
    amountMinor: 500,
    commissionMinor: 100,
    tenantShareMinor: 400,
    currency: "NGN",
    provider,
    account: "platform",
    providerReference: reference,
    receipt,
    customer: claims.buyer,
    fingerprint: sha(reference),
    reason: "Platform review of an unresolved refund outcome",
    requestedBy: oid(),
  });
  const childPaystack = sha("child-paystack-ops"),
    childKorapay = sha("child-korapay-ops"),
    childGift = sha("child-gift-ops"),
    childNoClaim = sha("child-noclaim-ops"),
    childSucceeded = sha("child-succeeded-ops");
  await Refund.create([
    {
      _id: oid(),
      merchantOrder: childPaystack,
      ...base(claims.paystackOrder, "dhm-payref-ops", "paystack:platform:dhm-payref-ops", "paystack"),
      state: "uncertain",
      issue: "Provider or ledger outcome requires reconciliation; do not resubmit",
    },
    {
      _id: oid(),
      merchantOrder: childKorapay,
      ...base(claims.korapayOrder, "dhm-korafallback-ops", "korapay:platform:dhm-korafallback-ops", "paystack"),
      state: "uncertain",
      issue: "",
    },
    {
      _id: oid(),
      merchantOrder: childGift,
      ...base(claims.giftOrder, String(claims.giftCardId), "gift_card:funding", "stripe"),
      state: "submitting",
      issue: "",
    },
    {
      _id: oid(),
      merchantOrder: childNoClaim,
      ...base(claims.noClaimOrder, "dhm-noclaim", "paystack:platform:dhm-noclaim", "paystack"),
      state: "submitting",
      issue: "",
    },
    {
      _id: oid(),
      merchantOrder: childSucceeded,
      ...base(claims.paystackOrder, "dhm-payref-ops", "paystack:platform:dhm-payref-ops", "paystack"),
      providerRefundId: "918274",
      state: "succeeded",
      issue: "",
    },
  ]);
  return { childPaystack, childKorapay, childGift, childNoClaim, childSucceeded };
}

async function insertCarriers(tenantA) {
  const oid = () => new mongoose.Types.ObjectId();
  const Booking = require("../models/MerchantCarrierBooking");
  const order = oid(),
    location = oid();
  const base = (child) => ({
    merchantOrder: child,
    order,
    tenant: tenantA,
    location,
    allocationId: `alloc-${child.slice(0, 8)}`,
    account: "TESTACCOUNT",
    review: oid().toString(),
    scopeHash: sha("scope"),
    quote: oid(),
    createdBy: oid(),
    rate: { courierId: "TEST", serviceCode: "STD", name: "Test", amountMinor: 1200, displayMinor: 1200 },
    scheduledFor: new Date(Date.now() + 86400000),
  });
  const childUncertain = sha("carrier-uncertain-ops"),
    childSubmitting = sha("carrier-submitting-ops"),
    childCancelPending = sha("carrier-cancelpending-ops"),
    childCancelRequested = sha("carrier-cancelrequested-ops"),
    childBooked = sha("carrier-booked-ops");
  await Booking.create([
    {
      _id: sha("booking-uncertain-ops"),
      ...base(childUncertain),
      fingerprint: sha("f1"),
      snapshot: { codes: [{ address: "Origin" }, { address: "Destination" }], pickupDate: new Date(Date.now() + 86400000).toISOString() },
      state: "uncertain",
      providerId: "SB-OPSBOOK01",
    },
    { _id: sha("booking-submitting-ops"), ...base(childSubmitting), fingerprint: sha("f2"), snapshot: { codes: [] }, state: "submitting" },
    { _id: sha("booking-cancelpending-ops"), ...base(childCancelPending), fingerprint: sha("f3"), snapshot: { codes: [] }, state: "cancel_pending" },
    { _id: sha("booking-cancelrequested-ops"), ...base(childCancelRequested), fingerprint: sha("f4"), snapshot: { codes: [] }, state: "cancel_requested" },
    { _id: sha("booking-booked-ops"), ...base(childBooked), fingerprint: sha("f5"), snapshot: { codes: [] }, state: "booked", providerId: "SB-OPSBOOK02", providerStatus: "confirmed" },
  ]);
  return { childUncertain, childSubmitting, childCancelPending, childCancelRequested, childBooked, order, location };
}

async function insertReturns(tenantA) {
  const oid = () => new mongoose.Types.ObjectId();
  const Return = require("../models/MerchantDeliveryReturn");
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const received = {
    tenant: tenantA,
    disposition: "quarantined",
    receivedBy: oid(),
    receivedAt: twoDaysAgo,
    reason: "Original sealed goods physically received",
  };
  const childPending = sha("return-pending-ops"),
    childDecided = sha("return-decided-ops");
  await Return.create([
    {
      _id: sha("return-alloc-pending-ops"),
      booking: sha("booking-pending-ops"),
      merchantOrder: childPending,
      order: oid(),
      location: oid(),
      shipmentAllocation: sha("return-alloc-pending-ops"),
      lines: [{ line: "l1", quantity: 2, ranges: [{ start: 0, quantity: 2 }] }],
      ...received,
    },
    {
      _id: sha("return-alloc-decided-ops"),
      booking: sha("booking-decided-ops"),
      merchantOrder: childDecided,
      order: oid(),
      location: oid(),
      shipmentAllocation: sha("return-alloc-decided-ops"),
      lines: [{ line: "l1", quantity: 2, ranges: [{ start: 0, quantity: 2 }] }],
      version: 3,
      inspections: [
        {
          line: "l1",
          ranges: [{ start: 0, quantity: 2 }],
          condition: "sealed",
          inspectedBy: oid(),
          inspectedAt: twoDaysAgo,
        },
      ],
      decisions: [
        {
          line: "l1",
          ranges: [{ start: 0, quantity: 2 }],
          treatment: "retain_quarantine",
          decidedBy: oid(),
          decidedAt: twoDaysAgo,
        },
      ],
      ...received,
    },
  ]);
  return { childPending, childDecided };
}

test("platform-ops operations modules and routes exist", { skip: !uri }, async () => {
  const service = require("../services/operations/exceptionsQueue");
  const readiness = require("../services/operations/readiness");
  const auditView = require("../services/operations/auditView");
  assert.equal(typeof service.list, "function");
  assert.equal(typeof service.inspect, "function");
  assert.equal(typeof readiness.snapshot, "function");
  assert.equal(typeof auditView.forEntity, "function");
  require("../routes/platformOps.routes");
});

test("operations queue filters per kind, denies merchant roles, is idempotent, wires discovery and shows audit", { skip: !uri }, async (t) => {
  await connectVenueMongo(t, "ops_readiness");
  const people = await users(t);
  const { call } = await mount(t);
  const claims = await insertClaims();
  const refunds = await insertRefunds(claims, people.tenantA);
  const carriers = await insertCarriers(people.tenantA);
  const returns = await insertReturns(people.tenantA);
  const AuditLog = require("../models/AuditLog");
  await AuditLog.create([
    {
      actorUserId: people.root._id,
      actorRole: "super_admin",
      action: "MERCHANT_REFUND_SUBMIT",
      actionCategory: "auth",
      targetType: "Order",
      targetId: claims.paystackOrder,
      targetTenantId: people.tenantA,
      changes: { after: { merchantOrder: refunds.childPaystack } },
      timestamp: new Date(),
    },
    {
      actorUserId: people.root._id,
      actorRole: "super_admin",
      action: "PLATFORM_OPS_REVIEW_NOTE",
      actionCategory: "update",
      targetType: "MerchantRefundAllocation",
      targetId: (await require("../models/MerchantRefundAllocation").findOne({ merchantOrder: refunds.childPaystack }).lean())._id,
      timestamp: new Date(),
    },
  ]);

  // Role denial: merchant roles and customers never reach platform-ops.
  for (const who of [people.owner, people.staff, people.customer]) {
    const denied = await call(who, "GET", "/exceptions?kind=refund");
    assert.equal(denied.status, 403, `${who.role} must not access the platform-ops queue`);
  }
  const service = require("../services/operations/exceptionsQueue");
  await assert.rejects(
    service.list({ _id: people.owner._id, role: "tenant_owner", tenant: people.tenantA }, { kind: "refund" }),
    (error) => error.statusCode === 403
  );

  // Queue filtering: refund exceptions only (uncertain/submitting).
  const refundList = await call(people.root, "GET", "/exceptions?kind=refund");
  assert.equal(refundList.status, 200, JSON.stringify(refundList.body));
  assert.equal(refundList.body.data.queueVersion, 1);
  assert.equal(refundList.body.data.kind, "refund");
  assert.equal(refundList.body.data.total, 4);
  const refundStates = Object.fromEntries(
    refundList.body.data.entries.map((e) => [e.merchantOrder, e])
  );
  assert.ok(refundStates[refunds.childPaystack]);
  assert.equal(refundStates[refunds.childPaystack].state, "uncertain");
  assert.equal(refundStates[refunds.childPaystack].tenant, String(people.tenantA));
  assert.equal(refundStates[refunds.childPaystack].amountMinor, 500);
  assert.equal(
    refundStates[refunds.childPaystack].issue,
    "Provider or ledger outcome requires reconciliation; do not resubmit"
  );
  assert.equal(typeof refundStates[refunds.childPaystack].ageDays, "number");
  assert.equal(
    refundStates[refunds.childKorapay].issue,
    "Provider or ledger outcome requires reconciliation; do not resubmit"
  );
  assert.ok(refundStates[refunds.childNoClaim]);
  assert.ok(refundStates[refunds.childGift]);
  assert.ok(!refundStates[refunds.childSucceeded], "succeeded allocations are not exceptions");

  // Carrier exceptions only (unresolved operations; booked excluded).
  const carrierList = await call(people.root, "GET", "/exceptions?kind=carrier");
  assert.equal(carrierList.status, 200, JSON.stringify(carrierList.body));
  assert.equal(carrierList.body.data.total, 4);
  const carrierStates = Object.fromEntries(
    carrierList.body.data.entries.map((e) => [e._id, e])
  );
  const uncertainBooking = carrierStates[sha("booking-uncertain-ops")];
  assert.equal(uncertainBooking.state, "uncertain");
  assert.equal(uncertainBooking.reason, "Platform financial reconciliation required");
  assert.equal(uncertainBooking.amountMinor, 1200);
  assert.equal(uncertainBooking.tenant, String(people.tenantA));
  assert.equal(carrierStates[sha("booking-submitting-ops")].state, "submitting");
  assert.ok(carrierStates[sha("booking-cancelpending-ops")]);
  assert.ok(carrierStates[sha("booking-cancelrequested-ops")]);
  assert.ok(!carrierStates[sha("booking-booked-ops")], "booked carrier operations are not exceptions");

  // Quarantined returns with pending/complete dispositions.
  const returnList = await call(people.root, "GET", "/exceptions?kind=return");
  assert.equal(returnList.status, 200, JSON.stringify(returnList.body));
  assert.equal(returnList.body.data.total, 2);
  const returnStates = Object.fromEntries(
    returnList.body.data.entries.map((e) => [e.merchantOrder, e])
  );
  assert.equal(returnStates[returns.childPending].dispositionState, "pending");
  assert.equal(returnStates[returns.childPending].reason, RETURN_EFFECTS_UNSUPPORTED);
  assert.equal(returnStates[returns.childPending].ageDays, 2);
  assert.equal(returnStates[returns.childDecided].dispositionState, "decided");
  assert.equal(returnStates[returns.childDecided].reason, RETURN_EFFECTS_UNSUPPORTED);

  // Unsupported queue filters fail closed.
  const badKind = await call(people.root, "GET", "/exceptions?kind=everything");
  assert.equal(badKind.status, 400);

  // Wired discovery helpers in refund inspect detail.
  const paystackDetail = await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childPaystack]._id}`);
  assert.equal(paystackDetail.status, 200, JSON.stringify(paystackDetail.body));
  assert.equal(paystackDetail.body.data.sources.status, "resolved");
  assert.equal(paystackDetail.body.data.sources.sources[0].provider, "paystack");
  assert.equal(paystackDetail.body.data.sources.sources[0].claim.reference, "dhm-payref-ops");
  assert.equal(paystackDetail.body.data.sources.sources[0].claim.transactionId, "918273");
  const korapayDetail = await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childKorapay]._id}`);
  assert.equal(korapayDetail.body.data.sources.status, "ambiguous");
  const noClaimDetail = await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childNoClaim]._id}`);
  assert.equal(noClaimDetail.body.data.sources.status, "unknown");
  const giftDetail = await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childGift]._id}`);
  assert.equal(giftDetail.body.data.storedValueFunding.status, "resolved");
  assert.equal(giftDetail.body.data.storedValueFunding.kind, "gift_card_purchase");
  assert.equal(String(giftDetail.body.data.storedValueFunding.target), String(claims.giftCardId));

  // Read-only audit history for the queued entity.
  const auditView = await call(
    people.root,
    "GET",
    `/audit?kind=refund&id=${refundStates[refunds.childPaystack]._id}`
  );
  assert.equal(auditView.status, 200, JSON.stringify(auditView.body));
  const actions = auditView.body.data.entries.map((e) => e.action);
  assert.deepEqual(actions.sort(), ["MERCHANT_REFUND_SUBMIT", "PLATFORM_OPS_REVIEW_NOTE"]);
  for (const entry of auditView.body.data.entries) {
    assert.equal(entry.changes, undefined, "audit projection is whitelisted");
    assert.equal(entry.actorRole, "super_admin");
  }
  assert.ok(paystackDetail.body.data.audit.length >= 1, "inspect detail carries audit history");

  // Zero-write idempotency: double reads are identical and mutate nothing.
  const first = JSON.stringify(
    (await call(people.root, "GET", "/exceptions?kind=refund")).body
  );
  const second = JSON.stringify(
    (await call(people.root, "GET", "/exceptions?kind=refund")).body
  );
  assert.equal(first, second, "double list read must be identical");
  const firstReadiness = JSON.stringify((await call(people.root, "GET", "/readiness")).body);
  const secondReadiness = JSON.stringify((await call(people.root, "GET", "/readiness")).body);
  assert.equal(firstReadiness, secondReadiness, "double readiness read must be identical");
  const countsBefore = {
    refunds: await require("../models/MerchantRefundAllocation").countDocuments(),
    returns: await require("../models/MerchantDeliveryReturn").countDocuments(),
    audits: await AuditLog.countDocuments(),
  };
  const RefundModel = require("../models/MerchantRefundAllocation");
  const ReturnModel = require("../models/MerchantDeliveryReturn");
  const refundStateBefore = (
    await RefundModel.findOne({ merchantOrder: refunds.childPaystack }).select("state").lean()
  ).state;
  const returnVersionBefore = (
    await ReturnModel.findOne({ merchantOrder: returns.childDecided }).select("version").lean()
  ).version;
  for (const path of [
    "/exceptions?kind=refund",
    "/exceptions?kind=carrier",
    "/exceptions?kind=return",
    "/readiness",
    `/exceptions/refund/${refundStates[refunds.childPaystack]._id}`,
  ])
    await call(people.root, "GET", path);
  const countsAfter = {
    refunds: await require("../models/MerchantRefundAllocation").countDocuments(),
    returns: await require("../models/MerchantDeliveryReturn").countDocuments(),
    audits: await AuditLog.countDocuments(),
  };
  assert.deepEqual(countsAfter, countsBefore, "reads must not write");
  // Inspect detail is idempotent too: a double read is JSON-identical.
  const firstInspect = JSON.stringify(
    (await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childPaystack]._id}`)).body
  );
  const secondInspect = JSON.stringify(
    (await call(people.root, "GET", `/exceptions/refund/${refundStates[refunds.childPaystack]._id}`)).body
  );
  assert.equal(firstInspect, secondInspect, "double inspect read must be identical");
  // Zero-write applies to the documents behind the projection, not just counts.
  assert.equal(
    (await RefundModel.findOne({ merchantOrder: refunds.childPaystack }).select("state").lean()).state,
    refundStateBefore,
    "read-only queue must not change the refund allocation state"
  );
  assert.equal(
    (await ReturnModel.findOne({ merchantOrder: returns.childDecided }).select("version").lean()).version,
    returnVersionBefore,
    "read-only queue must not change the return version"
  );

  // Readiness snapshot: exact notice, flags, queue counts, no private identities.
  const readiness = (await call(people.root, "GET", "/readiness")).body.data;
  assert.equal(readiness.notice, READY_NOTICE);
  assert.equal(typeof readiness.flags.merchantRefundsEnabled, "boolean");
  assert.equal(typeof readiness.flags.merchantPaystackRefundsEnabled, "boolean");
  assert.equal(typeof readiness.flags.merchantExternalCarrierEnabled, "boolean");
  assert.equal(readiness.queueCounts.refund, 4);
  assert.equal(readiness.queueCounts.carrier, 4);
  assert.equal(readiness.queueCounts.return, 2);
  assert.equal(readiness.returns.effectsSupported, false);
  assert.equal(readiness.returns.reason, RETURN_EFFECTS_UNSUPPORTED);
  assert.equal(
    readiness.zeroValueCancellation.reason,
    "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund."
  );
  const readinessText = JSON.stringify(readiness);
  assert.equal(readinessText.includes("dhm-payref-ops"), false, "no claim references in readiness");
  assert.equal(readinessText.includes("918273"), false, "no transaction ids in readiness");
  assert.equal(readinessText.includes("SB-OPSBOOK01"), false, "no provider ids in readiness");
});

test("platform-ops reconcile controls reuse the existing reviewed services and audit", { skip: !uri }, async (t) => {
  await connectVenueMongo(t, "ops_reconcile");
  const people = await users(t);
  const { call } = await mount(t);
  const oid = () => new mongoose.Types.ObjectId();
  const carriers = await insertCarriers(people.tenantA);
  const Budget = require("../models/MerchantDispatchBudget");
  const bookingId = sha("booking-uncertain-ops");
  await Budget.create({
    _id: carriers.childUncertain,
    order: carriers.order,
    tenant: people.tenantA,
    shippingMinor: 2000,
    reservedMinor: 1200,
    committedMinor: 0,
  });
  const transport = require("../services/deliveryProviders/external/transport");
  const originalRequest = transport.request;
  transport.request = async () => ({
    results: [
      {
        order_id: "SB-OPSBOOK01",
        status: "confirmed",
        ship_from: { address: "Origin" },
        ship_to: { address: "Destination" },
        payment: { currency: "NGN", type: "wallet", status: "completed", shipping_fee: "12.00" },
      },
    ],
  });
  t.after(() => {
    transport.request = originalRequest;
  });

  // Merchant roles are denied before any service call.
  const denied = await call(people.owner, "POST", `/carrier-exceptions/${bookingId}/reconcile`, {});
  assert.equal(denied.status, 403);

  // Extra fields are rejected (carrier control accepts no payload at all).
  const extra = await call(people.root, "POST", `/carrier-exceptions/${bookingId}/reconcile`, { note: "x" });
  assert.equal(extra.status, 400);

  // Existing reviewed carrier reconciliation: uncertain → booked, budget moved once.
  const reconciled = await call(people.root, "POST", `/carrier-exceptions/${bookingId}/reconcile`);
  assert.equal(reconciled.status, 200, JSON.stringify(reconciled.body));
  assert.equal(reconciled.body.data.booking.state, "booked");
  const budget = await Budget.findById(carriers.childUncertain).lean();
  assert.equal(budget.reservedMinor, 0);
  assert.equal(budget.committedMinor, 1200);
  const repeat = await call(people.root, "POST", `/carrier-exceptions/${bookingId}/reconcile`);
  assert.equal(repeat.status, 200, JSON.stringify(repeat.body));
  const budgetAfterRepeat = await Budget.findById(carriers.childUncertain).lean();
  assert.equal(budgetAfterRepeat.committedMinor, 1200, "reconciliation is once-only");
  const AuditLog = require("../models/AuditLog");
  // Each successful control invocation is audited; the underlying effect stays
  // once-only (booking booked, budget moved exactly once, verified above).
  const controlRows = await AuditLog.find({ action: "PLATFORM_OPS_CARRIER_RECONCILE" }).lean();
  assert.equal(controlRows.length, 2);
  assert.equal(
    controlRows.filter((row) => row.changes?.after?.merchantOrder === carriers.childUncertain).length,
    2
  );

  // Refund control: input validation and unknown-allocation failure stay explicit.
  const badBody = await call(people.root, "POST", "/refund-exceptions/507f1f77bcf86cd799439011/reconcile", {
    providerRefundId: "12345",
    extra: "x",
  });
  assert.equal(badBody.status, 400);
  const typoRoute = await call(people.root, "POST", "/refund-exceptions/507f1f77bcf86cd799439011/reconcil", {
    providerRefundId: "12345",
  });
  assert.equal(typoRoute.status, 404, "a mistyped reconcile path stays a route-level 404");
  const missing = await call(people.root, "POST", "/refund-exceptions/507f1f77bcf86cd799439011/reconcile", {
    providerRefundId: "12345",
  });
  assert.equal(missing.status, 404, JSON.stringify(missing.body));
});
