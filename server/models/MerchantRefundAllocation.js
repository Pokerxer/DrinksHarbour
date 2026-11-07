"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
module.exports =
  mongoose.models.MerchantRefundAllocation ||
  mongoose.model(
    "MerchantRefundAllocation",
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
        amountMinor: { type: Number, required: true, immutable: true },
        commissionMinor: { type: Number, required: true, immutable: true },
        tenantShareMinor: { type: Number, required: true, immutable: true },
        fulfillmentVersion: { type: Number, enum: [2], immutable: true, default: undefined },
        unitRanges: { type: [new Schema({ line: String, ranges: [new Schema({ start: Number, quantity: Number }, { _id: false })] }, { _id: false })], immutable: true, default: undefined },
        currency: {
          type: String,
          enum: ["NGN"],
          required: true,
          immutable: true,
        },
        provider: {
          type: String,
          enum: ["stripe", "paystack"],
          required: true,
          immutable: true,
        },
        account: {
          type: String,
          enum: ["platform"],
          required: true,
          immutable: true,
        },
        providerTransactionId: { type: String, immutable: true },
        providerReference: { type: String, required: true, immutable: true },
        receipt: { type: String, required: true, immutable: true },
        customer: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        fingerprint: { type: String, required: true, immutable: true },
        reason: { type: String, required: true, immutable: true },
        requestedBy: {
          type: Schema.Types.ObjectId,
          required: true,
          immutable: true,
        },
        executedBy: Schema.Types.ObjectId,
        state: {
          type: String,
          enum: ["reserved", "submitting", "uncertain", "succeeded"],
          default: "reserved",
        },
        providerRefundId: String,
        issue: String,
        processedAt: Date,
      },
      { timestamps: true, autoIndex: false },
    ),
  );
