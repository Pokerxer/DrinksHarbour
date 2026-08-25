// models/CreditNote.js
//
// AR credit note: reduces revenue/receivable for a customer (price
// adjustment, return, goodwill). Applying posts a `refund` journal entry
// (Dr Sales Revenue + Dr Tax Collected, Cr Receivables); cancelling posts the
// paired reversal — posted entries are never mutated.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const CreditNoteSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    number: { type: String, required: true, trim: true },
    customer: { type: ObjectId, ref: 'POSCustomer' },
    customerName: { type: String, trim: true },
    salesOrder: { type: ObjectId, ref: 'SalesOrder' },
    date: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500 },
    amount: { type: Number, required: true, min: 0 }, // ex-tax
    taxAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'applied', 'cancelled'],
      default: 'applied',
    },
    postedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CreditNoteSchema.index({ tenant: 1, number: 1 }, { unique: true });
CreditNoteSchema.index({ tenant: 1, status: 1, date: -1 });

module.exports =
  mongoose.models.CreditNote || mongoose.model('CreditNote', CreditNoteSchema);
