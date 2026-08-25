// models/JournalEntry.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const journalLineSchema = new Schema(
  {
    // Legacy free-string code (e.g. "4000"). Kept as the source of truth for
    // reports; accountId optionally links the line to the Account document.
    account: { type: String, required: true, trim: true },
    accountId: { type: ObjectId, ref: 'Account' },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    memo: { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    // Business document posted from. Undefined for manual entries; reversals
    // point at the ORIGINAL ENTRY's _id.
    refDoc: { type: ObjectId },
    refDocType: { type: String, required: true, default: 'SalesOrder' },
    entryType: {
      type: String,
      required: true,
      enum: [
        'accrued_revenue',
        'sales_revenue',
        'refund',
        'manual',
        'expense_accrual',
        'cogs',
        'tax_collected',
        'tax_paid',
        'inventory_adjust',
        'reversal',
        'customer_payment',
        'vendor_payment',
      ],
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

// Idempotency key for document postings and reversals. Partial so manual
// entries (no refDoc) never collide with each other.
JournalEntrySchema.index(
  { tenant: 1, refDoc: 1, entryType: 1 },
  { unique: true, partialFilterExpression: { refDoc: { $type: 'objectId' } } }
);

module.exports =
  mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);