// models/BatchPayment.js
//
// Groups posted customer/vendor payments for a bank deposit / reconciliation
// run. Organisational only — each payment already carries its own journal
// entry; the batch itself posts nothing (v1 decision, see RESUME doc).
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const BatchPaymentSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    number: { type: String, required: true, trim: true },
    direction: {
      type: String,
      enum: ['customer', 'vendor'],
      required: true,
    },
    date: { type: Date, default: Date.now },
    // Settlement account the batch is destined for: 1000 Cash or 1100 Bank.
    account: { type: String, enum: ['1000', '1100'], default: '1100' },
    total: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['open', 'deposited', 'cancelled'],
      default: 'open',
    },
    depositedAt: { type: Date },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

BatchPaymentSchema.index({ tenant: 1, number: 1 }, { unique: true });
BatchPaymentSchema.index({ tenant: 1, status: 1, date: -1 });

module.exports =
  mongoose.models.BatchPayment ||
  mongoose.model('BatchPayment', BatchPaymentSchema);
