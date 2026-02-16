// models/Order.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const orderItemSchema = new Schema({
  product: {
    type: ObjectId,
    ref: 'Product',           // central product for description / images / ABV
    required: true,
  },

  subproduct: {
    type: ObjectId,
    ref: 'SubProduct',        // tenant-specific variant
    required: false,
  },

  size: {
    type: ObjectId,
    ref: 'Size',              // specific volume / pricing unit
    required: false,
  },

  tenant: {
    type: ObjectId,
    ref: 'Tenant',
    required: false,
    index: true,
  },

  // Snapshot at purchase time
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  priceAtPurchase: {
    type: Number,
    required: true,
    min: 0,
  },

  itemSubtotal: {
    type: Number,
    required: true,
  },

  // Any item-level discount applied
  discountAmount: {
    type: Number,
    default: 0,
  },

  // For reporting / revenue share calculation
  tenantRevenueShare: {
    type: Number,
    default: 0,
  },

  // Platform commission for this item
  platformCommission: {
    type: Number,
    default: 0,
  },

  // Tenant revenue model snapshot for reporting
  tenantRevenueModel: {
    type: String,
    enum: ['markup', 'commission', 'platform_markup'],
    default: 'markup',
  },

  // Tenant's commission percentage (for commission model)
  tenantCommissionPercentage: {
    type: Number,
    default: 0,
  },

  // Tenant's markup percentage (for markup model)
  tenantMarkupPercentage: {
    type: Number,
    default: 40,
  },

  // Platform markup percentage (for platform_markup model)
  platformMarkupPercentage: {
    type: Number,
    default: 15,
  },
}, { _id: false });

const orderSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Identification
    // ────────────────────────────────────────────────
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      // index: true removed - unique:true already creates index
    },

    user: {
      type: ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    // ────────────────────────────────────────────────
    // Items & Totals
    // ────────────────────────────────────────────────
    items: [orderItemSchema],

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discountTotal: {
      type: Number,
      default: 0,
    },

    coupon: {
      type: ObjectId,
      ref: 'Coupon',
      sparse: true,
    },

    shippingFee: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Currency used for this order
    currency: {
      type: String,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN',
    },

    // ────────────────────────────────────────────────
    // Payment
    // ────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'mobile_money', 'cash_on_delivery', 'wallet'],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true,
    },

    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },

    paymentReference: {
      type: String,
      sparse: true,
    },

    paymentIntentId: {
      type: String,
      sparse: true,
    },

    paidAt: Date,

    paymentDetails: {
      method: String,
      transactionId: String,
      reference: String,
      amount: Number,
      currency: String,
      paidAt: Date,
      channel: String,
    },

    refundDetails: {
      refundId: String,
      amount: Number,
      reason: String,
      createdAt: Date,
    },

    // ────────────────────────────────────────────────
    // Shipping & Fulfillment
    // ────────────────────────────────────────────────
    shippingAddress: {
      fullName: String,
      email: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
      landmark: String,
      additionalInstructions: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
        placeId: String,
      },
    },

    // If different from shipping
    billingAddress: {
      // same structure as shippingAddress
      type: Object,
      default: null,
    },

    shippingMethod: {
      type: String,
      enum: ['standard', 'express', 'pickup', 'partner_delivery'],
    },

    // Per-tenant fulfillment status (critical for multi-tenant orders)
    fulfillmentStatus: {
      type: Map,
      of: String, // tenantId → 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
      default: () => new Map(),
    },

    // ────────────────────────────────────────────────
    // Compliance & Age Verification
    // ────────────────────────────────────────────────
    ageVerifiedAtOrderTime: {
      type: Boolean,
      default: false,
    },

    // ────────────────────────────────────────────────
    // Lifecycle & Status
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending',          // payment not completed
        'processing',       // payment ok, preparing
        'partially_shipped',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },

    placedAt: {
      type: Date,
      default: Date.now,
    },

    cancelledAt: Date,
    cancelReason: String,

    // ────────────────────────────────────────────────
    // Revenue & Platform Tracking
    // ────────────────────────────────────────────────
    platformCommissionTotal: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────
// Virtuals
// ────────────────────────────────────────────────

orderSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.virtual('isMultiTenant').get(function () {
  const tenants = new Set(this.items.map(item => item.tenant?.toString()).filter(Boolean));
  return tenants.size > 1;
});

// ────────────────────────────────────────────────
// Indexes (removed duplicate - orderNumber already has index from unique:true)
// ────────────────────────────────────────────────

orderSchema.index({ user: 1, placedAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });
orderSchema.index({ 'items.tenant': 1, status: 1 });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;