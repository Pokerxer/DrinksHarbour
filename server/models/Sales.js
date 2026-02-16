// models/Sales.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const saleSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Core relationships
    // ────────────────────────────────────────────────
    order: {
      type: ObjectId,
      ref: 'Order',
      sparse: true,                   // POS sales may not have an Order
      index: true,
    },

    user: {
      type: ObjectId,
      ref: 'User',
      sparse: true,                   // POS sales may be walk-in / cash customer (no logged-in user)
      index: true,
    },

    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
    },

    subproduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
    },

    size: {
      type: ObjectId,
      ref: 'Size',
      required: true,
    },

    // ────────────────────────────────────────────────
    // ← NEW → Purchase / Sales Channel
    // ────────────────────────────────────────────────
    channel: {
      type: String,
      enum: [
        'main_website',           // drinksharbour.com
        'tenant_online_store',    // shopname.drinksharbour.com
        'tenant_pos',             // in-store / physical location POS
        'tenant_manual',          // manual entry (e.g. phone order, bulk B2B)
      ],
      required: true,
      index: true,
    },

    channelDetail: {
      type: String,
      trim: true,
      maxlength: 100,
      // optional extra info, e.g. "POS Terminal #3", "iPad App v2.1"
    },

    // ────────────────────────────────────────────────
    // Transaction snapshot
    // ────────────────────────────────────────────────
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    priceAtSale: {
      type: Number,
      required: true,
      min: 0,
    },

    itemSubtotal: {
      type: Number,
      required: true,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    finalItemPrice: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN',
    },

    // ────────────────────────────────────────────────
    // Revenue split
    // ────────────────────────────────────────────────
    revenueModelUsed: {
      type: String,
      enum: ['markup', 'commission'],
      required: true,
    },

    platformAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    tenantAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ────────────────────────────────────────────────
    // Timing & Fulfillment
    // ────────────────────────────────────────────────
    soldAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    fulfilledAt: Date,

    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'fulfilled', 'cancelled', 'returned'],
      default: 'pending',
      index: true,
    },

    // For POS sales that are immediate
    isInstantFulfillment: {
      type: Boolean,
      default: false,
    },

    // ────────────────────────────────────────────────
    // Payment & Traceability
    // ────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: [
        'card', 'bank_transfer', 'mobile_money', 'cash', 'pos_terminal',
        'wallet', 'invoice', 'other'
      ],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'refunded'],
      default: 'paid',
    },

    transactionRef: String,
    paymentGatewayId: String,     // Stripe PI / Paystack ref / etc.

    // ────────────────────────────────────────────────
    // Audit
    // ────────────────────────────────────────────────
    createdBy: {
      type: ObjectId,
      ref: 'User',
      sparse: true,               // who recorded the sale (POS staff, system, tenant admin)
    },
  },
  {
    timestamps: true,
  }
);

// Indexes optimized for common reports
saleSchema.index({ tenant: 1, soldAt: -1 });
saleSchema.index({ channel: 1, soldAt: -1 });
saleSchema.index({ tenant: 1, channel: 1, fulfillmentStatus: 1 });
saleSchema.index({ product: 1, soldAt: -1 });
saleSchema.index({ subproduct: 1, soldAt: -1 });

const Sales = mongoose.models.Sales || mongoose.model('Sales', saleSchema);

module.exports = Sales;