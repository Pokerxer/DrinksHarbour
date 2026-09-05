const mongoose = require('mongoose');

// One document per referrer → referee pair, carrying the lifecycle of a single
// referral. Distinct from the loyalty ledger: an append-only points ledger has
// no room for state, which is why the previous referral implementation could
// not tell you whether a referral ever converted.
//
// Lifecycle:
//   pending    signup carried a valid code; nothing minted yet (email unverified)
//   qualified  email verified, referee's welcome coupon minted
//   paid       referee's first order was PAID; referrer credited
//   rejected   a guard refused it (self-dealing, or referrer over monthly cap)
//   reversed   the qualifying order was refunded
//
// Money terms are SNAPSHOTTED at creation — payouts read `terms`, never the
// live REFERRAL_CONFIG, so editing the config cannot retroactively rewrite an
// offer a customer already accepted.
const ReferralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Unique: "one referral per account, ever" is enforced by the DATABASE, not
    // by an app-level check that a concurrent signup could slip past.
    referee:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code:     { type: String, trim: true, uppercase: true },

    status: {
      type: String,
      enum: ['pending', 'qualified', 'paid', 'rejected', 'reversed'],
      default: 'pending',
      index: true,
    },

    coupon:          { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    qualifyingOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    payoutTxn:       { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformWalletTransaction', default: null },

    terms: {
      refereeLoyaltyPoints: { type: Number, required: true, min: 0 },
      referrerCreditNgn:  { type: Number, required: true, min: 0 },
      minSpendNgn:        { type: Number, required: true, min: 0 },
    },

    rejectedReason: { type: String, default: '', trim: true, maxlength: 280 },
    // True when a refund reversal could not be collected because the referrer
    // had already spent the credit. The wallet's overdraw guard is deliberate
    // and load-bearing; we record the shortfall rather than punch through it.
    reversalFailed: { type: Boolean, default: false },

    signupAt:    { type: Date, default: Date.now },
    qualifiedAt: { type: Date, default: null },
    paidAt:      { type: Date, default: null },
    reversedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

ReferralSchema.index({ referrer: 1, createdAt: -1 });        // the referrals page
ReferralSchema.index({ referrer: 1, status: 1, paidAt: -1 }); // the monthly cap

module.exports = mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);
