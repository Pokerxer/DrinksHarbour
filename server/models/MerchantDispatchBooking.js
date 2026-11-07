"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const schema = new Schema(
  {
    _id: String,
    merchantOrder: { type: String, required: true, immutable: true },
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    location: { type: Schema.Types.ObjectId, required: true, immutable: true },
    quote: { type: Schema.Types.ObjectId, required: true, immutable: true },
    delivery: { type: Schema.Types.ObjectId, required: true, immutable: true },
    amountMinor: { type: Number, required: true, immutable: true },
    currency: { type: String, enum: ["NGN"], required: true, immutable: true },
    lines: { type: [Schema.Types.Mixed], required: true, immutable: true },
    expectedVersion: { type: Number, required: true, immutable: true },
    contractSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    scopeHash: { type: String, required: true, immutable: true },
    fingerprint: { type: String, required: true, immutable: true },
    state: {
      type: String,
      enum: [
        "booked",
        "dispatched",
        "delivered",
        "failed",
        "cancelled",
        "returning",
        "returned",
      ],
      default: "booked",
    },
    version: { type: Number, default: 1 },
    shipmentAllocation: { type: String },
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    cancelledBy: Schema.Types.ObjectId,
    cancelKey: String,
    cancelReason: String,
    dispatchKey: String,
    dispatchFingerprint: String,
    activeDelivery: Schema.Types.ObjectId,
    recoveryOperations: { type: [Schema.Types.Mixed], default: [] },
    resolutionOperations: { type: [Schema.Types.Mixed], default: [] },
    resolveKey: String,
    resolveFingerprint: String,
    dispatchedBy: Schema.Types.ObjectId,
    resolvedBy: Schema.Types.ObjectId,
    events: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.MerchantDispatchBooking ||
  mongoose.model("MerchantDispatchBooking", schema);
