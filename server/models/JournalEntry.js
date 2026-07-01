// models/JournalEntry.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const journalLineSchema = new Schema(
  {
    account: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    memo: { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    refDoc: { type: ObjectId, required: true },
    refDocType: { type: String, required: true, default: 'SalesOrder' },
    entryType: {
      type: String,
      required: true,
      enum: ['accrued_revenue', 'sales_revenue', 'refund', 'manual'],
    },
    date: { type: Date, default: Date.now },
    period: { type: String, trim: true },
    source: { type: String, trim: true, default: 'sales_order' },
    lines: { type: [journalLineSchema], required: true },
    memo: { type: String, trim: true, maxlength: 1000 },
    postedBy: { type: ObjectId, ref: 'User' },
    postedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'posted'], default: 'posted' },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ tenant: 1, refDoc: 1, entryType: 1 }, { unique: true });

module.exports =
  mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);