// models/PaymentMethod.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const paymentMethodSchema = new Schema(
  {
    // Who owns / controls this payment method
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      sparse: true,                 // null = platform-wide default method
      index: true,
    },

    // Human-readable name shown to customers
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    // Internal/machine identifier
    code: {
      type: String,
      required: true,
      enum: [
        'card',                 // Stripe/Paystack card
        'bank_transfer',
        'mobile_money',
        'cash_on_delivery',
        'pos_terminal',
        'wallet',               // internal platform wallet (future)
        'invoice',              // B2B / post-payment
        'pay_at_pickup',
      ],
      index: true,
    },

    // Integration / gateway specific
    gateway: {
      type: String,
      enum: [
        'stripe',
        'paystack',
        'flutterwave',
        'manual',
        'none',                 // cash / pos
      ],
      default: 'manual',
    },

    gatewayConfig: {
      // encrypted or minimal metadata
      publicKey: String,
      merchantId: String,
      // secret keys should be stored in secure vault / env, not here
    },

    // Availability rules
    isActive: {
      type: Boolean,
      default: true,
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxOrderAmount: {
      type: Number,
      min: 0,
    },

    // Countries / regions where this method is allowed
    allowedCountries: [String],     // e.g. ['NG', 'GH', 'KE']

    // Fees / surcharges (percentage or fixed)
    surchargeType: {
      type: String,
      enum: ['none', 'fixed', 'percentage'],
      default: 'none',
    },

    surchargeValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Visual / UX
    icon: String,                   // heroicon name or simple emoji
    description: {
      type: String,
      maxlength: 280,
    },

    displayOrder: {
      type: Number,
      default: 999,
      index: true,
    },

    // Audit
    createdBy: {
      type: ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'deprecated'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentMethodSchema.index({ tenant: 1, code: 1 }, { unique: true });
paymentMethodSchema.index({ tenant: 1, isActive: 1, displayOrder: 1 });
paymentMethodSchema.index({ code: 1, tenant: { $exists: false } }); // platform defaults

const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod;