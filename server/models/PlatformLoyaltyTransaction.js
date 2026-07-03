const mongoose = require('mongoose');

// Append-only ledger for the PLATFORM-WIDE customer loyalty-points balance — the
// online (ecommerce) counterpart to the in-store-only LoyaltyTransaction. One row
// per balance change; rows are NEVER edited or deleted. The authoritative balance
// lives on User.loyaltyPoints / User.loyaltyLifetimePoints and is mutated atomically
// alongside appending a row here; `balanceAfter` snapshots the redeemable balance.
//
// Distinct from LoyaltyTransaction (tenant-scoped, POSCustomer-owned, in-store).
// Platform-scoped: no `tenant` field — points are earned and spent across tenants.
//
// Direction is derived from `type`: 'earn'/'bonus' add points, 'redeem'/'expiry'
// subtract them, and 'adjustment' is signed — its `points` may be negative to
// deduct. Every other type stores a positive `points` magnitude.
const PlatformLoyaltyTransactionSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:         { type: String, enum: ['earn', 'redeem', 'adjustment', 'bonus', 'expiry', 'referral'], required: true },
    points:       { type: Number, required: true }, // positive magnitude; signed for 'adjustment'
    balanceAfter: { type: Number, required: true }, // User.loyaltyPoints after this tx
    // The order or tenant the points were earned from / spent at — drives analytics.
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    redeemedAtTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    reason:       { type: String, default: '', trim: true, maxlength: 280 },
    reference:    { type: String, trim: true, sparse: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PlatformLoyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.PlatformLoyaltyTransaction
  || mongoose.model('PlatformLoyaltyTransaction', PlatformLoyaltyTransactionSchema);