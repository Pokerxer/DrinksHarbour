"use strict";
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Once-only provider EVIDENCE for koraRefund refunds (workstream K). Mirrors
// MerchantRefundEvidence `_id` semantics for the Korapay provider class:
// `_id = korapay:platform:<providerRefundId>` — Mongo's intrinsic _id index is
// the durable provider/account/refund identity, so a duplicate or late
// confirmation can never settle twice and one provider refund id can never
// serve two allocations.
module.exports =
  mongoose.models.MerchantKoraRefundEvidence ||
  mongoose.model(
    "MerchantKoraRefundEvidence",
    new Schema(
      {
        _id: { type: String, required: true },
        // The koraRefund allocation hash id (string _id, not ObjectId).
        allocation: { type: String, required: true, immutable: true },
        order: { type: Schema.Types.ObjectId, required: true, immutable: true },
        amountMinor: { type: Number, required: true, immutable: true },
        currency: { type: String, required: true, immutable: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
