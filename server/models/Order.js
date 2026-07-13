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

  // Snapshot of which pricelist rule(s) contributed to the price for this line
  appliedPricelistRule: {
    ruleId:        { type: Schema.Types.ObjectId },
    priceType:     { type: String },
    sequence:      { type: Number },
    discountAmount: { type: Number, default: 0 },
  },

  // ── Revenue snapshot (all amounts are per-LINE, not per-unit) ──────────────
  // tenantRevenueShare = what the platform owes the vendor for this line
  //   markup model  → costPriceAtPurchase × quantity
  //   commission    → itemSubtotal × (1 − commissionRate)
  tenantRevenueShare: {
    type: Number,
    default: 0,
  },

  // platformCommission = platform's net profit for this line
  //   markup model  → itemSubtotal − tenantRevenueShare
  //   commission    → itemSubtotal × commissionRate
  platformCommission: {
    type: Number,
    default: 0,
  },

  // Snapshot of the per-unit vendor cost at purchase time (markup model only)
  // This is the costPrice from SubProduct or Size — what the platform paid/owes the vendor
  vendorPriceAtPurchase: {
    type: Number,
    default: 0,
  },

  // Tenant revenue model snapshot for reporting
  tenantRevenueModel: {
    type: String,
    enum: ['markup', 'commission'],
    default: 'markup',
  },

  // Rate used at purchase time (commissionPercentage or markupPercentage, depending on model)
  revenueRateAtPurchase: {
    type: Number,
    default: 0,
  },
  // True when the quantity-triggered pack rate was applied to this line
  packRateApplied: {
    type: Boolean,
    default: false,
  },
  warehouse: { type: ObjectId, ref: 'Warehouse', required: false },

  // Which warehouse batches this line drew from (FEFO), for traceability and
  // exact refund restoration. Empty for non-tracked products / untracked stock.
  batchAllocations: [
    new Schema(
      {
        batch:       { type: ObjectId, ref: 'WarehouseBatch' },
        batchNumber: { type: String },
        quantity:    { type: Number, min: 0 },
        expiryDate:  { type: Date, default: null },
      },
      { _id: false }
    ),
  ],
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
      enum: ['card', 'bank_transfer', 'mobile_money', 'cash_on_delivery', 'cash', 'wallet', 'split'],
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
      change: Number,
      splitPayments: [{ method: String, amount: Number }],
      // POS customer snapshot (walk-in or named customer). `customerId` links
      // back to the POSCustomer record when a named customer was attached at the
      // till — it's what the Contacts directory matches an in-store contact's
      // orders on (walk-ins leave it null and are matched by phone only).
      customer: {
        firstName:  String,
        lastName:   String,
        phone:      String,
        customerId: { type: ObjectId, ref: 'POSCustomer', default: null },
      },
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
        'pending',          // payment not completed / awaiting confirmation
        'confirmed',        // order confirmed by admin
        'hold',             // saved cart, not yet paid — recalled orders are deleted
        'processing',       // being prepared / packed
        'partially_shipped',
        'shipped',          // handed to courier
        'delivered',        // customer received
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

    confirmedAt:  Date,
    processingAt: Date,
    shippedAt:    Date,
    deliveredAt:  Date,
    cancelledAt:  Date,
    cancelReason: String,

    // ────────────────────────────────────────────────
    // Shipping Calculation Metadata
    // ────────────────────────────────────────────────
    shippingInfo: {
      distanceKm:   { type: Number, default: null },
      routeType:    { type: String, enum: ['direct', 'single-vendor', 'multi-vendor'], default: null },
      stops:        { type: Number, default: null },
      daysMin:      { type: Number, default: null },
      daysMax:      { type: Number, default: null },
      zone:         { type: String, default: null },
      zoneLabel:    { type: String, default: null },
      isFree:       { type: Boolean, default: false },
      source:       { type: String, enum: ['google', 'zone'], default: null },
    },

    // ────────────────────────────────────────────────
    // Revenue & Platform Tracking
    // ────────────────────────────────────────────────
    platformCommissionTotal: {
      type: Number,
      default: 0,
    },

    // ────────────────────────────────────────────────
    // Order Origin
    // ────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['web', 'pos', 'app', 'manual'],
      default: 'web',
      index: true,
    },

    receiptNumber: {
      type: String,
      index: true,
      sparse: true,
    },
    posSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSSession',
      default: null,
    },
    posStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    voidedAt:   { type: Date, default: null },
    voidedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, default: '' },
    isVoided:   { type: Boolean, default: false },

    // Pricelist selected during this POS session
    appliedPricelist: {
      pricelistId:   { type: Schema.Types.ObjectId, ref: 'Pricelist' },
      pricelistName: { type: String, default: '' },
      // Cart-level spend-threshold discount granted by cart_threshold rules
      // (already included in discountTotal; kept here for receipt breakdown).
      thresholdDiscount: { type: Number, default: 0 },
    },

    // Cart metadata for hold orders — stores client-side cart context so it
    // can be fully restored on recall (customer, discounts, rewards, etc.).
    holdMetadata: {
      type: Schema.Types.Mixed,
      default: null,
    },

    refunds: [{
      receiptNumber:    String,
      items: [{
        orderItemIndex: Number,   // index into order.items array
        quantity:       Number,   // units returned
        unitPrice:      Number,   // per-unit refund price used
        discPct:        Number,   // deduction % applied (0 = full value)
        amount:         Number,   // final refund amount for this line = unitPrice * qty * (1 - discPct/100)
        restock:        { type: Boolean, default: true },  // whether stock was returned
        reason:         String,   // per-line reason
      }],
      totalRefunded:    Number,
      reason:           String,
      refundedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      refundedAt:       { type: Date, default: Date.now },
      paymentMethod:    String,   // payment method used for the refund (if different from original)
    }],
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