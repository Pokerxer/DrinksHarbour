const mongoose = require('mongoose');

// A PLATFORM gift card: standalone stored value with its own code, balance and
// scannable QR, usable at any tenant. `code` is stored normalized (uppercase, no
// separators); the dashed display form is derived in giftCard.helpers. `code` and
// `qrToken` are generated on issue (Phase 2), so both are sparse-unique (absent
// while pending_payment). Platform-scoped: no `tenant` field.
const GiftCardSchema = new mongoose.Schema(
  {
    code:          { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    qrToken:       { type: String, unique: true, sparse: true },
    initialAmount: { type: Number, required: true, min: 1 },
    balance:       { type: Number, required: true, default: 0, min: 0 },
    currency:      { type: String, enum: ['NGN'], default: 'NGN' },
    status:        {
      type: String,
      enum: ['pending_payment', 'active', 'redeemed', 'expired', 'disabled'],
      default: 'pending_payment',
      index: true,
    },
    purchasedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipient: {
      email:   { type: String, trim: true, lowercase: true },
      name:    { type: String, trim: true },
      message: { type: String, trim: true, maxlength: 280 },
      sendAt:  { type: Date },
    },
    design: {
      templateId: { type: String, trim: true },
      theme:      { type: String, trim: true },
      tier:       { type: String, trim: true }, // derived amount-tier id, stamped on issue
    },
    expiresAt:  { type: Date },
    paymentRef: { type: String, trim: true, sparse: true },
  },
  { timestamps: true }
);

GiftCardSchema.index({ 'recipient.email': 1 });

module.exports = mongoose.models.GiftCard || mongoose.model('GiftCard', GiftCardSchema);
