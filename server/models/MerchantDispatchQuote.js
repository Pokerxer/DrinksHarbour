"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const schema = new Schema(
  {
    merchantOrder: { type: String, required: true, immutable: true },
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    location: { type: Schema.Types.ObjectId, required: true, immutable: true },
    customer: { type: Schema.Types.ObjectId, required: true, immutable: true },
    provider: {
      type: String,
      enum: ["local_dispatch"],
      default: "local_dispatch",
      immutable: true,
    },
    currency: { type: String, enum: ["NGN"], required: true, immutable: true },
    amountMinor: { type: Number, required: true, immutable: true },
    lines: { type: [Schema.Types.Mixed], required: true, immutable: true },
    expectedVersion: { type: Number, required: true, immutable: true },
    requirements: { type: Schema.Types.Mixed, required: true, immutable: true },
    contract: { type: String, required: true, immutable: true },
    contractVersion: { type: Number, required: true, immutable: true },
    coverageRule: { type: Number, required: true, immutable: true },
    scopeHash: { type: String, required: true, immutable: true },
    expiresAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    bookedBy: String,
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.MerchantDispatchQuote ||
  mongoose.model("MerchantDispatchQuote", schema);
