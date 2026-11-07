'use strict';
const mongoose = require('mongoose');

// Once-only COMMAND RECORD for merchant order component refunds (workstream
// T: tax + discount). NOT a money movement: this record binds the immutable
// child component (taxMinor/discountMinor), the recorded policy version and
// the recorded journal/re-credit treatment OUTCOME. The idempotency key IS
// the _id (sha256 of `merchant-component-refund:<kind>:<childId>:<key>` —
// Phase A CheckoutDebit primitive), so concurrent duplicate commands collide
// on the primary key and exactly one record survives. No journals, budgets,
// counters or group totals are touched by these commands.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ['tax', 'discount'], required: true },
    merchantOrder: { type: String, required: true, immutable: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    currency: { type: String, enum: ['NGN'], required: true, immutable: true },
    // The bound immutable child component (taxMinor or discountMinor).
    componentMinor: { type: Number, required: true, min: 0, immutable: true },
    allocatedMinor: { type: Number, required: true, min: 1, immutable: true },
    // Conservation snapshot after this allocation (componentMinor − allocated).
    remainderMinorAfter: { type: Number, required: true, min: 0 },
    fingerprint: { type: String, required: true, immutable: true },
    reason: { type: String, required: true, immutable: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantComponentRefundPolicy', required: true, immutable: true },
    policyVersion: { type: Number, required: true, min: 1, immutable: true },
    // Recorded treatment OUTCOMES only — this package writes no journals.
    treatment: { type: String, immutable: true },
    journalOutcomeState: {
      type: String, enum: ['no_reverse_required', 'not_applicable', 'review_required'],
    },
    journalOutcomeReason: { type: String },
    fundingValues: { type: [String], default: undefined, immutable: true },
    recreditOutcomeState: {
      type: String, enum: ['recorded', 'not_applicable', 'review_required'],
    },
    recreditOutcomeReason: { type: String },
    state: { type: String, enum: ['allocated'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', autoIndex: false },
);
schema.index({ merchantOrder: 1, kind: 1 });

module.exports =
  mongoose.models.MerchantComponentRefundAllocation ||
  mongoose.model('MerchantComponentRefundAllocation', schema);
