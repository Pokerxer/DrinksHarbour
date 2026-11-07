"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
const line = new Schema(
  {
    line: { type: Schema.Types.ObjectId, required: true },
    product: Schema.Types.ObjectId,
    subproduct: Schema.Types.ObjectId,
    size: Schema.Types.ObjectId,
    quantity: Number,
    grossMinor: Number,
    discountMinor: Number,
    merchandiseMinor: Number,
    tenantShareMinor: Number,
    commissionMinor: Number,
  },
  { _id: false },
);
const schema = new Schema(
  {
    _id: String,
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
    },
    tenant: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      immutable: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      immutable: true,
    },
    currency: { type: String, enum: ["NGN"], required: true, immutable: true },
    lines: { type: [line], required: true, immutable: true },
    allocationPolicy: { type: String, required: true, immutable: true },
    ...Object.fromEntries(
      [
        "grossMinor",
        "discountMinor",
        "merchandiseMinor",
        "tenantShareMinor",
        "commissionMinor",
        "shippingMinor",
        "taxMinor",
        "totalMinor",
      ].map((key) => [
        key,
        { type: Number, required: true, immutable: true, min: 0 },
      ]),
    ),
    fulfillmentVersion: { type: Number, enum: [2], immutable: true, default: undefined },
    quantityProgress: { type: [{ line: String, shipped: { type: Number, default: 0 }, delivered: { type: Number, default: 0 }, cancelled: { type: Number, default: 0 }, financialBlocks: [{ start: Number, quantity: Number, refund: Schema.Types.ObjectId, kind: { type: String, enum: ['reserved', 'refunded'] } }] }], default: undefined },
    state: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "picking",
        "shipped",
        "partially_shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    version: { type: Number, default: 1 },
    refundReservedMinor: { type: Number, default: 0 },
    refundedMinor: { type: Number, default: 0 },
    refundedCommissionMinor: { type: Number, default: 0 },
    acceptedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ tenant: 1, state: 1, createdAt: -1 });
schema.index({ order: 1 });
module.exports =
  mongoose.models.MerchantOrder || mongoose.model("MerchantOrder", schema);
