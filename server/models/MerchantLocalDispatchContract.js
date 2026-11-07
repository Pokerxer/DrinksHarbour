"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const schema = new Schema(
  {
    _id: String,
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    location: { type: Schema.Types.ObjectId, required: true, immutable: true },
    version: { type: Number, required: true, immutable: true },
    status: { type: String, enum: ["reviewed", "revoked"], required: true },
    currency: { type: String, enum: ["NGN"], required: true, immutable: true },
    amountMinor: { type: Number, required: true, immutable: true },
    maxUnits: { type: Number, required: true, immutable: true },
    maxWeightGrams: { type: Number, required: true, immutable: true },
    vehicleTypes: { type: [String], required: true, immutable: true },
    coverage: { type: [Schema.Types.Mixed], required: true, immutable: true },
    capabilities: { type: Schema.Types.Mixed, required: true, immutable: true },
    reviewReference: { type: String, required: true, immutable: true },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    reviewedAt: { type: Date, required: true, immutable: true },
    validUntil: { type: Date, required: true, immutable: true },
    revokedBy: Schema.Types.ObjectId,
    revokedAt: Date,
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.MerchantLocalDispatchContract ||
  mongoose.model("MerchantLocalDispatchContract", schema);
