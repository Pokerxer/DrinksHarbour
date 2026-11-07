'use strict';
const mongoose = require('mongoose');

// Per-child REMAINDER GUARD for merchant component refunds (workstream T).
// NOT a ledger: the financial ledgers remain JournalEntry and the existing
// MerchantRefundAllocation budgets, which these commands never touch. One
// document per `<childId>:<kind>`; `allocatedMinor` is advanced atomically by
// a conditional findOneAndUpdate so concurrent commands with DIFFERENT
// idempotency keys can never over-allocate the immutable child component
// (allocatedMinor + amount ≤ componentMinor is evaluated server-side).
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${childId}:${kind}`
    componentMinor: { type: Number, required: true, min: 0 },
    allocatedMinor: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', autoIndex: false },
);

module.exports =
  mongoose.models.MerchantComponentRefundRemainder ||
  mongoose.model('MerchantComponentRefundRemainder', schema);
