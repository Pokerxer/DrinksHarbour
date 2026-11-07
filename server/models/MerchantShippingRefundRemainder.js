"use strict";
// Per-child REMAINDER GUARD for shipping-refund allocations (workstream S2).
// One document per merchant child; `allocatedMinor` is advanced atomically by
// a conditional findOneAndUpdate so concurrent allocation commands with
// DIFFERENT idempotency keys can never over-allocate the immutable child
// shippingMinor (allocatedMinor + amount ≤ shippingMinor is evaluated
// server-side). `shippingMinor` is frozen from the child on first allocation.
const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // the merchant child id
    shippingMinor: { type: Number, required: true, min: 1 },
    allocatedMinor: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);

module.exports =
  mongoose.models.MerchantShippingRefundRemainder ||
  mongoose.model("MerchantShippingRefundRemainder", schema);
