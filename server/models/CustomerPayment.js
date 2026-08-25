// models/CustomerPayment.js
//
// AR payment: money received from a customer, allocated across open sales
// orders. Posting: Dr Cash/Bank, Cr Receivables (`customer_payment` entry).
// Cancelling reverses the journal and rolls the allocations back.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const allocationSchema = new Schema(
  {
    salesOrder: { type: ObjectId, ref: 'SalesOrder', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CustomerPaymentSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    number: { type: String, required: true, trim: true },
    customer: { type: ObjectId, ref: 'POSCustomer' },
    customerName: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'pos', 'wallet'],
      default: 'cash',
    },
    reference: { type: String, trim: true },
    allocations: { type: [allocationSchema], default: [] },
    batch: { type: ObjectId, ref: 'BatchPayment', default: null },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CustomerPaymentSchema.index({ tenant: 1, number: 1 }, { unique: true });
CustomerPaymentSchema.index({ tenant: 1, status: 1, date: -1 });

module.exports =
  mongoose.models.CustomerPayment ||
  mongoose.model('CustomerPayment', CustomerPaymentSchema);
