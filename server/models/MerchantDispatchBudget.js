"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const schema = new Schema(
  {
    _id: String,
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    shippingMinor: { type: Number, required: true, immutable: true },
    reservedMinor: { type: Number, default: 0 },
    committedMinor: { type: Number, default: 0 },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.MerchantDispatchBudget ||
  mongoose.model("MerchantDispatchBudget", schema);
