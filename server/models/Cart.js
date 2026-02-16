// models/Cart.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const cartItemSchema = new Schema({
  // Core references – what the user actually added
  product: {
    type: ObjectId,
    ref: 'Product',           // central catalog (description, images, ABV, etc.)
    required: true,
  },

  subproduct: {
    type: ObjectId,
    ref: 'SubProduct',        // tenant-specific instance
    required: true,
  },

  size: {
    type: ObjectId,
    ref: 'Size',              // specific size/volume variant
    required: true,
  },

  tenant: {
    type: ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },

  // Snapshot of price at time of addition (protects against price changes)
  priceAtAddition: {
    type: Number,
    required: true,
    min: 0,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  // Snapshot of stock/availability at add time (helps UX)
  maxAvailableAtAddition: {
    type: Number,
    min: 0,
  },

  // Optional – if tenant applies item-level discount
  discountApplied: {
    type: Number,
    default: 0,
    min: 0,
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false }); // sub-document, no separate _id

const cartSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Owner
    // ────────────────────────────────────────────────
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,             // one active cart per user
      // index: true removed - unique:true already creates index
    },

    // ────────────────────────────────────────────────
    // Items
    // ────────────────────────────────────────────────
    items: [cartItemSchema],

    // ────────────────────────────────────────────────
    // Totals & promotions (updated on change)
    // ────────────────────────────────────────────────
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Optional coupon applied to the whole cart
    coupon: {
      type: ObjectId,
      ref: 'Coupon',
      sparse: true,
    },

    discountTotal: {
      type: Number,
      default: 0,
    },

    // Shipping & tax – usually calculated at checkout based on address
    // kept here only as preview / override
    estimatedShipping: {
      type: Number,
      default: 0,
    },

    estimatedTax: {
      type: Number,
      default: 0,
    },

    // Final preview total (subtotal - discount + shipping + tax)
    estimatedTotal: {
      type: Number,
      default: 0,
    },

    // ────────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'abandoned', 'converted', 'expired'],
      default: 'active',
      index: true,
    },

    // Optional – for guest carts or auto-cleanup
    expiresAt: {
      type: Date,
      expires: '30d', // MongoDB TTL index – auto-remove after 30 days inactivity
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

cartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

cartSchema.virtual('isEmpty').get(function () {
  return this.items.length === 0;
});

// ────────────────────────────────────────────────
// Indexes (removed duplicate - user already has index from unique:true)
// ────────────────────────────────────────────────

cartSchema.index({ status: 1, updatedAt: -1 });

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

module.exports = Cart;