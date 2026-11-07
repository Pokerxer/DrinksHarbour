"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
// Once-only provider payout evidence (workstream P), modeled on the
// MerchantRefundEvidence discipline: Mongo's intrinsic _id index IS the
// durable `provider:account:transferId` identity, so duplicate or late
// provider confirmations can never reconcile a transfer twice. Evidence rows
// are immutable; only an evidence row — never a raw provider report — may
// settle an executing/uncertain transfer.
module.exports =
  mongoose.models.MerchantPayoutEvidence ||
  mongoose.model(
    "MerchantPayoutEvidence",
    new Schema(
      {
        _id: { type: String, required: true },
        transfer: { type: String, required: true, immutable: true },
        order: { type: Schema.Types.ObjectId, required: true, immutable: true },
        tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
        amountMinor: {
          type: Number,
          required: true,
          immutable: true,
          validate: Number.isSafeInteger,
        },
        currency: { type: String, required: true, immutable: true },
        providerTransferId: { type: String, immutable: true },
        recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
