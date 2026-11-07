"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
module.exports =
  mongoose.models.MerchantOrderSet ||
  mongoose.model(
    "MerchantOrderSet",
    new Schema(
      {
        _id: { type: Schema.Types.ObjectId, ref: "Order" },
        version: { type: Number, default: 1 },
        currency: { type: String, required: true, immutable: true },
        totalMinor: { type: Number, required: true, immutable: true },
        refundReservedMinor: { type: Number, default: 0 },
        refundedMinor: { type: Number, default: 0 },
        children: { type: [String], required: true, immutable: true },
        allocationPolicy: { type: String, required: true, immutable: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
