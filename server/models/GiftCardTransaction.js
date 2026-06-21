const mongoose = require('mongoose');

// Append-only ledger for a GiftCard's balance changes; one row per change, never
// edited or deleted. The authoritative balance lives on GiftCard.balance, mutated
// atomically alongside appending a row here; `balanceAfter` snapshots it.
const GiftCardTransactionSchema = new mongoose.Schema(
  {
    giftCardId:   { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', required: true, index: true },
    type:         { type: String, enum: ['issue', 'redeem', 'refund', 'adjustment'], required: true },
    amount:       { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true },
    // Set on redeems spent at a tenant — drives platform→tenant settlement. Null otherwise.
    redeemedAtTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    reference:    { type: String, trim: true, sparse: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GiftCardTransactionSchema.index({ giftCardId: 1, createdAt: -1 });

module.exports = mongoose.models.GiftCardTransaction
  || mongoose.model('GiftCardTransaction', GiftCardTransactionSchema);
