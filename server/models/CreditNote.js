// models/CreditNote.js
//
// AR credit note: reduces revenue/receivable for a customer (price
// adjustment, return, goodwill).
//
// Lifecycle is draft → applied → cancelled. A note only touches the GL when it
// is POSTED, which is one journal entry for the full note total
// (Dr Sales Revenue + Dr Tax Collected, Cr Receivables). Cancelling a posted
// note posts the paired reversal — posted entries are never mutated.
//
// `unappliedAmount` is the part of a posted note that no invoice has absorbed
// yet. It is what makes a standalone credit usable: the credit is already
// reflected in the GL, so the sub-ledger has to record where it sits or the
// receivable control account and the sum of open invoices disagree.
//
// This model is the single source of truth for customer credit. There is no
// cached balance on POSCustomer — a denormalised balance is exactly what drifts.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

// Sub-ledger of where this note's credit was spent. Applying credit is NOT a
// GL movement; the receivable was credited once at post time, and these rows
// only record which invoice the credit settled.
const CreditAllocationSchema = new Schema(
  {
    salesOrder: { type: ObjectId, ref: 'SalesOrder', required: true },
    amount: { type: Number, required: true, min: 0 }, // VAT-inclusive
    appliedAt: { type: Date, default: Date.now },
    appliedBy: { type: ObjectId, ref: 'User' },
  },
  { _id: false }
);

const CreditNoteSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    // Optional: assigned at post time, not at creation, so the posted sequence
    // stays gapless — a discarded draft does not burn a number.
    number: { type: String, trim: true },
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
      default: 'draft',
    },
    // VAT-inclusive credit not yet consumed by an invoice. Meaningful only
    // while status is 'applied'.
    unappliedAmount: { type: Number, default: 0, min: 0 },
    allocations: { type: [CreditAllocationSchema], default: [] },
    postedAt: { type: Date, default: null },
    postedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// The unique index is PARTIAL, and that is load-bearing rather than incidental.
// Drafts carry no number, and a plain unique index treats a missing value as one
// shared value — so a plain index would permit exactly one unnumbered draft per
// tenant and the second insert would fail with E11000. Restricting it to actual
// strings keeps drafts outside the constraint entirely.
CreditNoteSchema.index(
  { tenant: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: 'string' } } }
);
CreditNoteSchema.index({ tenant: 1, status: 1, date: -1 });
// Serves the unapplied-credit balance and the per-customer ledger.
CreditNoteSchema.index({ tenant: 1, customer: 1, status: 1, postedAt: 1 });

CreditNoteSchema.post('save', async function (doc) {
  await require('../services/customerInvoice/hooks').allocationsSaved(doc);
});
module.exports =
  mongoose.models.CreditNote || mongoose.model('CreditNote', CreditNoteSchema);
