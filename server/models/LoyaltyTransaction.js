const mongoose = require('mongoose');

// An append-only ledger entry for a customer's loyalty-points balance. One row per
// balance change; rows are NEVER edited or deleted. The authoritative running
// balance lives on the owner record (POSCustomer.loyaltyPoints) and is mutated
// atomically alongside appending a row here — `balanceAfter` snapshots the owner
// balance immediately after this transaction.
//
// Loyalty is IN-STORE ONLY (ecommerce User customers have no points), so the owner
// is always a POSCustomer: a 'both' contact's loyalty lives on its in-store record,
// consistent with contactKey. `ownerType` is kept (constant 'POSCustomer') to mirror
// WalletTransaction's shape.
//
// Direction is derived from `type`: 'earn'/'bonus' add points, 'redeem'/'expiry'
// subtract them, and 'adjustment' is signed — its `points` may be negative to
// deduct. Every other type stores a positive `points` magnitude.
const LoyaltyTransactionSchema = new mongoose.Schema(
  {
    tenant:       { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    ownerType:    { type: String, enum: ['POSCustomer'], default: 'POSCustomer', required: true },
    owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'POSCustomer', required: true, index: true },
    type:         { type: String, enum: ['earn', 'redeem', 'adjustment', 'bonus', 'expiry'], required: true },
    points:       { type: Number, required: true }, // positive magnitude; signed for 'adjustment'
    balanceAfter: { type: Number, required: true }, // owner balance after this tx
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    // e.g. a POS receipt / order number; sparse so it doesn't index blanks.
    reference:    { type: String, trim: true, sparse: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One ledger read per owner, newest first — drives the loyalty page table.
LoyaltyTransactionSchema.index({ tenant: 1, ownerType: 1, owner: 1, createdAt: -1 });

module.exports = mongoose.model('LoyaltyTransaction', LoyaltyTransactionSchema);
