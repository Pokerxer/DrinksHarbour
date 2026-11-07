"use strict";
const mongoose = require("mongoose");

// The explicit NO-MONEY record for a zero-only release (workstream Z). This is
// the only artifact a zero-value unit release ever creates: it records that no
// money moved — no provider transaction exists, every financial component is
// zero — and stamps the recorded immutable policy version and the verbatim
// audit wording the release executed under. No budget, allocation, journal,
// refund counter or goods basis is ever touched by this release.
const line = new mongoose.Schema(
  {
    line: { type: String, required: true },
    quantity: { type: Number, required: true },
    ranges: [{ start: Number, quantity: Number }],
    batchAllocations: [{ batch: mongoose.Schema.Types.ObjectId, quantity: Number }],
  },
  { _id: false },
);
const financials = new mongoose.Schema(
  {
    merchandiseMinor: { type: Number, default: 0 },
    shippingMinor: { type: Number, default: 0 },
    taxMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, default: 0 },
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    merchantOrder: { type: String, required: true, immutable: true },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    kind: { type: String, enum: ["no_money"], required: true, immutable: true },
    policyId: { type: String, required: true, immutable: true },
    policyVersion: { type: Number, required: true, immutable: true },
    auditWording: { type: String, required: true, immutable: true },
    financials: { type: financials, required: true, immutable: true },
    providerTransaction: {
      type: String,
      enum: ["none"],
      required: true,
      immutable: true,
    },
    lines: { type: [line], required: true, immutable: true },
  },
  { timestamps: true, strict: "throw", autoIndex: false },
);
module.exports =
  mongoose.models.MerchantNoMoneyRelease ||
  mongoose.model("MerchantNoMoneyRelease", schema);
