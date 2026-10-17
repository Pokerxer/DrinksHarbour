// models/BatchPayment.js
//
// Groups posted customer/vendor payments for a bank deposit / reconciliation
// run. Organisational only — each payment already carries its own journal
// entry; the batch itself posts nothing (v1 decision, see RESUME doc).
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const memberSchema = new Schema(
  {
    key: { type: String, required: true },
    origin: { type: String, enum: ["accounting", "sales", "pos"], required: true },
    account: { type: String, enum: ["1000", "1100", "2200"], required: true },
    paymentId: ObjectId,
    journalId: ObjectId,
    sourceId: ObjectId,
    number: String,
    name: String,
    date: Date,
    method: String,
    capturedAmount: { type: Number, required: true, min: 0 },
    refundedAmount: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    sourceHref: String,
    invoice: { id: String, label: String, href: String },
    allocations: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);
const BatchPaymentSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: "Tenant", required: true, index: true },
    number: { type: String, required: true, trim: true },
    direction: {
      type: String,
      enum: ["customer", "vendor"],
      required: true,
    },
    date: { type: Date, default: Date.now },
    // Reconciliation account: 1000 Cash, 1100 Bank or 2200 Wallet; no transfer.
    account: { type: String, enum: ["1000", "1100", "2200"], default: "1100" },
    total: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["open", "deposited", "cancelled"],
      default: "open",
    },
    depositedAt: { type: Date },
    members: { type: [memberSchema], default: undefined },
    membershipVersion: Number,
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);

BatchPaymentSchema.index({ tenant: 1, number: 1 }, { unique: true });
BatchPaymentSchema.index({ tenant: 1, status: 1, date: -1 });

module.exports = mongoose.models.BatchPayment || mongoose.model("BatchPayment", BatchPaymentSchema);
