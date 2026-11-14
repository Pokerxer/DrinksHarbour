const mongoose = require('mongoose');

// An append-only ledger entry for a tenant's prepaid advertising wallet. One
// row per balance change; rows are NEVER edited or deleted. The authoritative
// running balance lives on the owner record (Tenant.adWalletBalance) and is
// mutated atomically alongside appending a row here — `balanceAfter` snapshots
// the tenant balance immediately after this transaction. Mirrors the
// customer-wallet pattern of server/models/WalletTransaction.js.
const AdWalletTransactionSchema = new mongoose.Schema(
  {
    tenant:       { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type:         { type: String, enum: ['credit', 'debit'], required: true },
    amount:       { type: Number, required: true, min: 1 }, // positive integer NGN
    balanceAfter: { type: Number, required: true },         // tenant balance after this tx
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    // e.g. the Paystack top-up reference; sparse so it doesn't index blanks.
    // Credit idempotency keys on this (service layer matches reference+credit).
    reference:    { type: String, trim: true, sparse: true },
    // Set on click debits so a ledger row traces back to its campaign.
    campaign:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdCampaign' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One ledger read per tenant, newest first — drives the ad wallet page table.
AdWalletTransactionSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('AdWalletTransaction', AdWalletTransactionSchema);
