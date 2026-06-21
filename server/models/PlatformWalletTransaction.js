const mongoose = require('mongoose');

// Append-only ledger for the PLATFORM-WIDE customer wallet (platformWallet) — a
// tenant-agnostic stored-value balance. One row per balance change; never edited
// or deleted. The authoritative balance lives on User.platformWalletBalance and is
// mutated atomically alongside appending a row here; `balanceAfter` snapshots it.
// DISTINCT from the tenant store-credit WalletTransaction (which requires `tenant`).
const PlatformWalletTransactionSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:         { type: String, enum: ['credit', 'debit', 'refund', 'adjustment'], required: true },
    amount:       { type: Number, required: true, min: 1 }, // positive integer NGN
    balanceAfter: { type: Number, required: true },
    // Set on debits spent at a tenant — drives platform→tenant settlement. Null otherwise.
    redeemedAtTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    source:       { type: String, enum: ['purchase', 'pos', 'online_checkout', 'refund', 'adjustment'], required: true },
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    reference:    { type: String, trim: true, sparse: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    paymentRef:   { type: String, trim: true, sparse: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PlatformWalletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.PlatformWalletTransaction
  || mongoose.model('PlatformWalletTransaction', PlatformWalletTransactionSchema);
