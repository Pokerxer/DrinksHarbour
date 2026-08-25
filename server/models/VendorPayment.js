// models/VendorPayment.js
//
// AP payment: money paid to a vendor, allocated across open vendor bills.
// Posting: Dr Payables, Cr Cash/Bank (`vendor_payment` entry). Cancelling
// reverses the journal and rolls the allocations back.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const allocationSchema = new Schema(
  {
    vendorBill: { type: ObjectId, ref: 'VendorBill', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const VendorPaymentSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    number: { type: String, required: true, trim: true },
    vendor: { type: ObjectId, ref: 'Vendor' },
    vendorName: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'pos', 'wallet'],
      default: 'bank_transfer',
    },
    reference: { type: String, trim: true },
    allocations: { type: [allocationSchema], default: [] },
    batch: { type: ObjectId, ref: 'BatchPayment', default: null },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

VendorPaymentSchema.index({ tenant: 1, number: 1 }, { unique: true });
VendorPaymentSchema.index({ tenant: 1, status: 1, date: -1 });

module.exports =
  mongoose.models.VendorPayment ||
  mongoose.model('VendorPayment', VendorPaymentSchema);
