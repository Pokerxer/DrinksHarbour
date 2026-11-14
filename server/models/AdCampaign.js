const mongoose = require('mongoose');

// A tenant's self-serve sponsored-placement campaign (phase 2 merchandising).
// Prepaid-only by agreement (docs/memory/selling-price-markup.md): a campaign
// can never spend money the tenant has not loaded — the running prepaid
// balance lives on Tenant.adWalletBalance, and every debit appends an
// immutable row to AdWalletTransaction (see the click handler, Task 9).
//
// Spend counters (spentToday/spentTotal/clicksTotal/impressionsTotal) are
// denormalised aggregates maintained by the click pipeline; spentDay is the
// 'YYYY-MM-DD' key that spentToday rolls over against.
const AdCampaignSchema = new mongoose.Schema(
  {
    tenant:       { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name:         { type: String, required: true, trim: true, maxlength: 120 },
    product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Where the sponsored placement renders: product detail page and/or cart.
    // required alone is not enough — Mongoose does not fail an empty array —
    // so ≥1 is enforced by an explicit validator.
    surfaces:     {
      type: [{ type: String, enum: ['pdp', 'cart'] }],
      required: true,
      validate: {
        validator: (list) => Array.isArray(list) && list.length >= 1,
        message: 'At least one surface (pdp or cart) is required',
      },
    },
    status:       {
      type: String,
      enum: ['draft', 'active', 'paused', 'budget_exhausted', 'expired', 'suspended'],
      default: 'draft',
      index: true,
    },
    startsAt:     Date,
    endsAt:       Date,
    dailyBudget:  { type: Number, required: true, min: 1 }, // positive integer NGN
    spentToday:   { type: Number, default: 0, min: 0 },
    // 'YYYY-MM-DD' (UTC) the spentToday counter belongs to; '' until first spend.
    spentDay:     { type: String, default: '' },
    spentTotal:   { type: Number, default: 0, min: 0 },
    clicksTotal:  { type: Number, default: 0, min: 0 },
    impressionsTotal: { type: Number, default: 0, min: 0 },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Eligibility sweep for sponsored slots: active campaigns on a given surface.
AdCampaignSchema.index({ status: 1, surfaces: 1 });

module.exports = mongoose.model('AdCampaign', AdCampaignSchema);
