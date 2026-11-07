"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;

// Once-only recorded payout HOLD document (workstream P). Holds are the ONLY
// clawback/netting lever the mechanism can represent: a recorded hold
// permanently reduces the child's statement-linked transferable base (via
// the MerchantPayoutBalance guard) and is recorded — never executed as money
// movement. _id IS the idempotency anchor:
// sha256("merchant-payout-hold:" + childId + ":" + idempotencyKey).
module.exports =
  mongoose.models.MerchantPayoutHold ||
  mongoose.model(
    "MerchantPayoutHold",
    new Schema(
      {
        _id: { type: String, required: true },
        child: { type: String, required: true, immutable: true },
        order: { type: Schema.Types.ObjectId, required: true, immutable: true },
        tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
        currency: { type: String, enum: ["NGN"], required: true, immutable: true },
        amountMinor: {
          type: Number,
          required: true,
          min: 1,
          immutable: true,
          validate: Number.isSafeInteger,
        },
        reason: {
          type: String,
          required: true,
          trim: true,
          maxlength: 300,
          immutable: true,
        },
        policyId: { type: Schema.Types.ObjectId, immutable: true },
        policyVersion: { type: Number, required: true, immutable: true },
        recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
