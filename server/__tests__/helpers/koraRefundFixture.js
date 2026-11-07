"use strict";
// Synthetic korapay marketplace fixtures for workstream K tests. These create
// exactly the recorded identities refundSources/discovery.js binds: an
// allocated MarketplacePaymentClaim `korapay:platform:<reference>` whose
// receipt.transactionId either FELL BACK to the merchant reference (the
// ambiguous identity recorded in phase-d-finance-completion.md:7 /
// payment.service.js:358) or is a distinct provider transaction identity.
// No real Korapay call is ever made; no credentials exist anywhere.
const mongoose = require("mongoose");
const oid = () => new mongoose.Types.ObjectId();
let seq = 0;

// Explicitly synthetic recorded policy (production has none). Super-admin
// actor; the identity decision is recorded verbatim as the operator made it.
async function recordPolicy(overrides = {}) {
  const { record } = require("../../services/merchantFulfillment/koraRefund/policy");
  return record(
    {
      endpointsShapeReference:
        "SYNTHETIC reviewed Korapay refund endpoints shape: POST /v1/transactions/:reference/refund with authenticated retrieval by saved refund id (test-only recording; no real endpoint was reviewed or called).",
      authMode: "SYNTHETIC bearer-token mode recorded verbatim; no credential exists or is stored.",
      refundRequestContract:
        "SYNTHETIC request contract: explicit minor NGN amount against the original payment reference with a transport-level idempotency key.",
      refundResponseContract:
        "SYNTHETIC response contract: created refund returns a provider refund id; retrieval by the saved id only.",
      uncertaintyBehavior:
        "SYNTHETIC uncertainty rule: unknown or late outcomes leave the allocation reserved-uncertain; only authenticated retrieval by the saved id settles it.",
      idempotencyConvention:
        "SYNTHETIC idempotency convention: one refund request per command key; replays never re-submit.",
      acceptFallbackTransactionId: true,
      refundFeeBearer: "platform_bears",
      decisionReference: "SYNTHETIC-K-POLICY",
      ...overrides,
    },
    { _id: oid(), role: "super_admin" },
  );
}

async function korapayCheckoutFixture({ amountNaira = 20, fallback = true } = {}) {
  const reference = `dhm-synth-${++seq}`;
  const buyer = oid();
  const orderId = oid();
  const transactionId = fallback ? reference : `kora-txn-${seq}`;
  await require("../../models/MarketplacePaymentClaim").create({
    _id: `korapay:platform:${reference}`,
    provider: "korapay",
    account: "platform",
    reference,
    user: buyer,
    amount: amountNaira,
    currency: "NGN",
    state: "allocated",
    order: orderId,
    receipt: {
      method: "korapay",
      reference,
      transactionId,
      amount: amountNaira,
      currency: "NGN",
      paidAt: new Date(),
      channel: "card",
    },
  });
  await require("../../models/Order").collection.insertOne({
    _id: orderId, user: buyer, totalAmount: amountNaira, currency: "NGN",
    paymentStatus: "paid", status: "confirmed",
    paymentDetails: { method: "korapay", reference, transactionId },
    paymentReference: reference,
  });
  return { buyer, orderId, reference, transactionId, claimId: `korapay:platform:${reference}`, originalMinor: amountNaira * 100 };
}

async function paystackCheckoutFixture({ amountNaira = 20 } = {}) {
  const reference = `dhm-psynth-${++seq}`;
  const buyer = oid();
  const orderId = oid();
  await require("../../models/MarketplacePaymentClaim").create({
    _id: `paystack:platform:${reference}`,
    provider: "paystack",
    account: "platform",
    reference,
    user: buyer,
    amount: amountNaira,
    currency: "NGN",
    state: "allocated",
    order: orderId,
    receipt: {
      method: "paystack", reference, transactionId: `474197${seq}`,
      amount: amountNaira, currency: "NGN", paidAt: new Date(),
    },
  });
  await require("../../models/Order").collection.insertOne({
    _id: orderId, user: buyer, totalAmount: amountNaira, currency: "NGN",
    paymentStatus: "paid", status: "confirmed",
    paymentDetails: { method: "paystack", reference, transactionId: `474197${seq}` },
    paymentReference: reference,
  });
  return { orderId, claimId: `paystack:platform:${reference}` };
}

// Injected synthetic transport (Transport interface: request/verify). Returns
// queued outcomes per call without touching any network.
function syntheticTransport(outcomes = {}) {
  const calls = [];
  const pick = (kind) => {
    const value = outcomes[kind];
    if (value instanceof Error) throw value;
    return value;
  };
  return {
    calls,
    request(envelope) { calls.push({ kind: envelope.kind ?? "request", envelope }); return Promise.resolve(pick("request")); },
    verify(envelope) { calls.push({ kind: envelope.kind ?? "verify", envelope }); return Promise.resolve(pick("verify")); },
  };
}

module.exports = { korapayCheckoutFixture, paystackCheckoutFixture, recordPolicy, syntheticTransport, oid, seq: () => seq };
