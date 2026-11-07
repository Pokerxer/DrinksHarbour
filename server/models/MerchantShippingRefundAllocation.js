"use strict";
// Once-only COMMAND RECORD for shipping-refund allocations (workstream S2).
// The idempotency key IS the _id
// (sha256(`merchant-shipping-refund:${merchantOrder}:${idempotencyKey}`)), so
// concurrent duplicate commands collide on the primary key and exactly one
// allocation survives. This record is a policy-gated ENTITLEMENT record: it
// binds the original allocated receipt identity and the immutable child
// shippingMinor and RECORDS the policy's bearer outcome and journal treatment
// as data. It never executes carrier recovery, merchant billing, provider
// refunds or journal postings — settlement execution requires its own
// separately reviewed step.
const mongoose = require("mongoose");
const policy = require("./MerchantShippingRefundPolicy");

const schema = new mongoose.Schema(
  {
    // The idempotency key itself.
    _id: { type: String, required: true },
    merchantOrder: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    currency: { type: String, enum: ["NGN"], required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    // Frozen snapshot of the immutable child shippingMinor at allocation time.
    shippingMinor: { type: Number, required: true, min: 1 },
    // Exact remainder still refundable after this allocation — conservation snapshot.
    remainderMinorAfter: { type: Number, required: true, min: 0 },
    // Original allocated receipt identity (single allocated platform claim).
    receipt: { type: String, required: true },
    receiptProvider: { type: String, enum: ["stripe", "paystack"], required: true },
    receiptAccount: { type: String, enum: ["platform"], required: true },
    receiptReference: { type: String, required: true },
    receiptTransactionId: { type: String },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eligibilityCondition: {
      type: String,
      enum: policy.CONDITIONS,
      required: true,
    },
    // RECORDED bearer outcome from the policy — recorded, never executed.
    bearerOutcome: { type: String, enum: policy.BEARERS, required: true },
    // RECORDED journal treatment from the policy — recorded, never posted.
    journalTreatment: { type: String, enum: policy.TREATMENTS, required: true },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantShippingRefundPolicy",
      required: true,
    },
    policyVersion: { type: Number, required: true, min: 1 },
    state: { type: String, enum: ["allocated"], required: true },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);

module.exports =
  mongoose.models.MerchantShippingRefundAllocation ||
  mongoose.model("MerchantShippingRefundAllocation", schema);
