const mongoose = require('mongoose');

// A platform→tenant payable: when platform stored value (wallet or gift card) is
// consumed at a tenant, one entry records what the platform owes that tenant.
// SCHEMA ONLY in Phase 1 — no writer exists until the redemption phases. The
// source ledger row is referenced polymorphically via sourceModel + sourceTxId.
const PlatformSettlementSchema = new mongoose.Schema(
  {
    tenant:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    instrument:  { type: String, enum: ['platform_wallet', 'gift_card'], required: true },
    sourceModel: { type: String, enum: ['PlatformWalletTransaction', 'GiftCardTransaction'], required: true },
    sourceTxId:  { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceModel' },
    amount:      { type: Number, required: true, min: 1 },
    relatedOrder:{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status:      { type: String, enum: ['pending', 'settled'], default: 'pending', index: true },
    settledAt:   { type: Date },
  },
  { timestamps: true }
);

PlatformSettlementSchema.index({ tenant: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.PlatformSettlement
  || mongoose.model('PlatformSettlement', PlatformSettlementSchema);
