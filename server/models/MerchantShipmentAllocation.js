"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const range = new Schema(
  {
    start: { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false },
);
const schema = new Schema(
  {
    _id: String,
    merchantOrder: { type: String, required: true, immutable: true },
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    location: { type: Schema.Types.ObjectId, required: true, immutable: true },
    currency: { type: String, required: true, immutable: true },
    lines: {
      type: [
        new Schema(
          {
            line: { type: String, required: true },
            quantity: { type: Number, required: true },
            ranges: { type: [range], required: true },
            movementReference: String,
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
    state: {
      type: String,
      enum: ["shipped", "delivered"],
      required: true,
      default: "shipped",
    },
    version: { type: Number, default: 1 },
    dispatchBooking: { type: String, immutable: true, default: undefined },
    shippedBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    deliveredBy: Schema.Types.ObjectId,
    deliveredAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ tenant: 1, merchantOrder: 1, createdAt: -1 });
module.exports =
  mongoose.models.MerchantShipmentAllocation ||
  mongoose.model("MerchantShipmentAllocation", schema);
