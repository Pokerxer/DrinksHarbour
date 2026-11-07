"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
// Mongo's intrinsic _id index is the durable provider/account/refund identity.
module.exports =
  mongoose.models.MerchantRefundEvidence ||
  mongoose.model(
    "MerchantRefundEvidence",
    new Schema(
      {
        _id: { type: String, required: true },
        allocation: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        order: { type: Schema.Types.ObjectId, required: true, immutable: true },
        amountMinor: { type: Number, required: true, immutable: true },
        currency: { type: String, required: true, immutable: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
