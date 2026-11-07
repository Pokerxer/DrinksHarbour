"use strict";
const mongoose = require("mongoose");

// Per-claim REMAINDER GUARD for koraRefund refunds (workstream K). NOT a
// ledger — the exact claim identity stays the immutable MarketplacePaymentClaim
// row; this record conserves the refundable remainder across multiple refunds
// against the SAME original claim. `refundedMinor` is advanced atomically by a
// conditional findOneAndUpdate so concurrent commands with DIFFERENT
// idempotency keys can never refund more than the original claim amount
// (refundedMinor + amount ≤ originalMinor is evaluated server-side).
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // the korapay claim identity `korapay:platform:<reference>`
    originalMinor: { type: Number, required: true, min: 1, immutable: true },
    refundedMinor: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);

module.exports = mongoose.models.MerchantKoraRefundRemainder
  || mongoose.model("MerchantKoraRefundRemainder", schema);
