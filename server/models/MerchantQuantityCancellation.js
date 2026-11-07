"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
module.exports =
  mongoose.models.MerchantQuantityCancellation ||
  mongoose.model(
    "MerchantQuantityCancellation",
    new Schema(
      {
        _id: Schema.Types.ObjectId,
        merchantOrder: { type: String, required: true, immutable: true },
        order: { type: Schema.Types.ObjectId, required: true, immutable: true },
        tenant: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        location: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        releasedBy: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        lines: {
          type: [
            new Schema(
              {
                line: String,
                quantity: Number,
                ranges: [{ start: Number, quantity: Number }],
                batchAllocations: [
                  { batch: Schema.Types.ObjectId, quantity: Number },
                ],
              },
              { _id: false },
            ),
          ],
          required: true,
          immutable: true,
        },
      },
      { timestamps: true, autoIndex: false },
    ),
  );
