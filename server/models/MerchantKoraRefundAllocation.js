"use strict";
const mongoose = require("mongoose");

// Once-only COMMAND + ALLOCATION RECORD for koraRefund refunds (workstream K).
// NOT a second ledger: the exact conservation momentum lives in
// MerchantKoraRefundRemainder and the once-only settle evidence in
// MerchantKoraRefundEvidence. The `_id` IS the idempotency anchor —
// sha256(`kora-refund:<claimIdentity>:<idempotencyKey>`) (Phase A
// CheckoutDebit primitive) — so concurrent duplicate commands collide on the
// primary key and exactly one provider request survives. The frozen fields
// bind the ORIGINAL receipt identity exactly as refundSources/discovery.js
// resolved it (read-import, unmodified).
const schema = new mongoose.Schema(
  {
    // The idempotency anchor itself.
    _id: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    // The original allocated claim identity `korapay:platform:<reference>`.
    claim: { type: String, required: true, immutable: true },
    provider: { type: String, enum: ["korapay"], required: true, immutable: true },
    account: { type: String, enum: ["platform"], required: true, immutable: true },
    // The original provider payment reference the refund is anchored to.
    providerReference: { type: String, required: true, immutable: true },
    // The receipt's distinct Korapay transactionId when it is NOT the
    // ambiguous fallback; null when the fallback identity was accepted.
    receiptTransactionId: { type: String, immutable: true },
    fallbackAccepted: { type: Boolean, required: true, immutable: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    currency: { type: String, enum: ["NGN"], required: true, immutable: true },
    amountMinor: { type: Number, required: true, min: 1, immutable: true },
    // Conservation snapshot of the original claim.
    claimAmountMinor: { type: Number, required: true, min: 1, immutable: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "MerchantKoraRefundPolicy", required: true, immutable: true },
    policyVersion: { type: Number, required: true, min: 1, immutable: true },
    // Recorded fee bearer/treatment (data only — executed by NOTHING). Copied
    // from the recorded Kora policy and the fee-treatment authority's
    // newest kora_refund-flow version at execution time.
    feeBearer: { type: String, immutable: true },
    feeBearerState: { type: String, enum: ["recorded_not_executed", "not_applicable"], required: true, immutable: true },
    feeJournalTreatment: { type: String, immutable: true },
    feeTreatmentPolicyId: { type: mongoose.Schema.Types.ObjectId, ref: "MerchantFeeTreatmentPolicy", immutable: true },
    feeTreatmentVersion: { type: Number, immutable: true },
    // Mutable execution state: provider refund id, uncertainty issue and the
    // conservation snapshot (originalMinor - remainder at this allocation).
    state: { type: String, enum: ["requested", "uncertain", "settled"], required: true },
    providerRefundId: String,
    issue: String,
    remainderMinorAfter: { type: Number, required: true, min: 0 },
    processedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);

module.exports = mongoose.models.MerchantKoraRefundAllocation
  || mongoose.model("MerchantKoraRefundAllocation", schema);
