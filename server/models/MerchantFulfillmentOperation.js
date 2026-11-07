"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
module.exports =
  mongoose.models.MerchantFulfillmentOperation ||
  mongoose.model(
    "MerchantFulfillmentOperation",
    new Schema(
      {
        _id: String,
        actor: { type: Schema.Types.ObjectId, required: true, immutable: true },
        action: { type: String, required: true, immutable: true },
        merchantOrder: { type: String, required: true },
        tenant: { type: Schema.Types.ObjectId, required: true },
        fingerprint: { type: String, required: true },
        result: { type: Schema.Types.Mixed, required: true },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
