'use strict';
const mongoose = require('mongoose');

// Once-only COMMAND RECORD for original-source stored-value refund credits
// (workstream W). NOT a balance ledger — the append-only ledgers remain
// PlatformWalletTransaction / GiftCardTransaction. This record reuses the Phase
// A CheckoutDebit primitive: the idempotency key IS the _id
// (sha256(`stored-value-refund-credit:${debitTransaction}:${idempotencyKey}`)),
// so concurrent duplicate commands collide on the primary key and exactly one
// ledger write survives. Created inside the credit transaction; replayed
// commands rebuild their result from this record alone.
const schema = new mongoose.Schema(
  {
    // The idempotency key itself (Phase A CheckoutDebit primitive).
    _id: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    kind: { type: String, enum: ['wallet', 'gift_card'], required: true },
    destinationType: { type: String, enum: ['wallet_user', 'gift_card'], required: true },
    destinationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['NGN'], required: true },
    // The exact original checkout debit being reversed.
    debitTransaction: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    debitCreatedAt: { type: Date, required: true },
    originalMinor: { type: Number, required: true, min: 1 },
    // Remainder (minor) still refundable after this credit — conservation snapshot.
    remainderMinorAfter: { type: Number, required: true, min: 0 },
    fundingStatus: { type: String },
    fundingReason: { type: String },
    ledgerModel: { type: String, enum: ['PlatformWalletTransaction', 'GiftCardTransaction'], required: true },
    ledgerId: { type: mongoose.Schema.Types.ObjectId },
    balanceAfter: { type: Number },
    // Platform→tenant settlement the original debit was redeemed at (Q5d).
    reconciledTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoredValueRefundPolicy', required: true },
    policyVersion: { type: Number, required: true, min: 1 },
    state: { type: String, enum: ['credited'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', autoIndex: false },
);

module.exports = mongoose.models.StoredValueRefundCredit
  || mongoose.model('StoredValueRefundCredit', schema);
