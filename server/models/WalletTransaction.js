const mongoose = require('mongoose');

// An append-only ledger entry for a customer's stored-value wallet (store
// credit). One row per balance change; rows are NEVER edited or deleted. The
// authoritative running balance lives on the owner record (POSCustomer.walletBalance
// or User.walletBalance) and is mutated atomically alongside appending a row here —
// `balanceAfter` snapshots the owner balance immediately after this transaction.
//
// `ownerType` + `ownerId` point at whichever store record holds the wallet: a
// 'both' contact's wallet lives on its POSCustomer, consistent with contactKey.
const WalletTransactionSchema = new mongoose.Schema(
  {
    tenant:       { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    ownerType:    { type: String, enum: ['POSCustomer', 'User'], required: true },
    ownerId:      { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    // Direction is derived from type: 'debit' lowers the balance, every other
    // type ('credit'/'refund'/'adjustment') raises it.
    type:         { type: String, enum: ['credit', 'debit', 'adjustment', 'refund'], required: true },
    amount:       { type: Number, required: true, min: 1 }, // positive integer NGN
    balanceAfter: { type: Number, required: true },         // owner balance after this tx
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    // e.g. a POS receipt / order number; sparse so it doesn't index blanks.
    reference:    { type: String, trim: true, sparse: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One ledger read per owner, newest first — drives the wallet page table.
WalletTransactionSchema.index({ tenant: 1, ownerType: 1, ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
