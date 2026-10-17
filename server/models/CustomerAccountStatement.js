// models/CustomerAccountStatement.js
//
// An append-only ledger of what a customer owes on their account ("tab") and
// what they have paid back. One row per event; rows are never edited or deleted.
//
// Two deliberate departures from WalletTransaction, both about not being able
// to be wrong silently:
//
//  1. NO `balanceAfter`. WalletTransaction can afford one because it is written
//     in the same transaction as an atomic `$inc` on the owner. Here the balance
//     is a $sum over these rows, so a running total would be a second source of
//     truth that races itself whenever two sales are rung at once. The
//     authoritative balance is the aggregate; `balance()` in the service returns
//     it.
//
//  2. `amount` is always POSITIVE and `entryType` carries the direction. A
//     signed amount would let a mistyped negative payment flip a customer's tab
//     the other way — a balance that reads as though they were owed money.
//     This way the mistake fails validation.
//
// This ledger does NOT post to the general ledger, and must not. The debt is
// already booked: a charge rides the POS order journal (Dr Receivables 1300) and
// a payment rides a CustomerPayment (Dr Cash / Cr Receivables 1300). These rows
// are the customer-facing view of events the ledger already knows about, which is
// what keeps the two from disagreeing.

const mongoose = require('mongoose');

const CustomerAccountStatementSchema = new mongoose.Schema(
  {
    tenant:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'POSCustomer', required: true },

    // 'charge' raises what they owe, 'payment' lowers it, and 'credit' lowers it
    // with no money moving — a partial refund of a sale that went on the tab.
    // Not the same as a payment: the customer handed nothing over, so recording
    // one as a payment would put cash in the drawer that was never there.
    entryType: { type: String, enum: ['charge', 'payment', 'credit'], required: true },
    amount:    { type: Number, required: true, min: 1 }, // always positive

    // How the charge was tendered ('wallet'/'account' split) or how the payment
    // was received. Kept for the history a customer may ask for.
    method:       { type: String, trim: true, maxlength: 40 },
    reference:    { type: String, trim: true, maxlength: 80 },
    receiptNumber: { type: String, trim: true, maxlength: 40 },
    posSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'POSSession' },
    staff:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    note: { type: String, trim: true, maxlength: 280 },

    // Set only when a manager authorised a sale that breached the credit limit.
    // The limit is a control on exposure, not a substitute for an audit trail,
    // so an override has to say who and why.
    overrideBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overrideReason: { type: String, trim: true, maxlength: 280 },

    occurredAt: { type: Date, default: Date.now },

    // A void reverses the entry's effect without deleting the row. Not exposed
    // by any endpoint yet — a return flow is what will need it.
    voided:   { type: Boolean, default: false },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The statement for one customer, newest first — the only read pattern.
CustomerAccountStatementSchema.index({ tenant: 1, customer: 1, occurredAt: -1 });
// Balances aggregate by customer over a window; the credit limit is read per sale.
CustomerAccountStatementSchema.index({ tenant: 1, customer: 1, entryType: 1 });
// Reconciliation against the journal: find every charge raised for one receipt.
CustomerAccountStatementSchema.index({ tenant: 1, receiptNumber: 1 }, { sparse: true });

CustomerAccountStatementSchema.post('save', async function (doc) {
  try { await require('../services/customerInvoice/hooks').customerLedgerSaved(doc); }
  catch (err) { console.error('invoiceLedgerSyncFailed', { message: err.message }); }
});
module.exports = mongoose.models.CustomerAccountStatement
  || mongoose.model('CustomerAccountStatement', CustomerAccountStatementSchema);
