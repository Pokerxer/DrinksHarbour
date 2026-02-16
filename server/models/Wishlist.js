// models/Wishlist.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const wishlistItemSchema = new Schema({
  product: {
    type: ObjectId,
    ref: 'Product',           // central catalog product
    required: true,
  },

  // Optional – if user added it from a specific tenant's store
  addedFromSubproduct: {
    type: ObjectId,
    ref: 'SubProduct',
    sparse: true,
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },

  // User can add personal note ("for birthday gift", "try this rum")
  note: {
    type: String,
    trim: true,
    maxlength: 200,
  },

  // Optional priority / grouping feature
  priority: {
    type: String,
    enum: ['high', 'medium', 'low', 'gift'],
    default: 'medium',
  },

  // For future "notify me when in stock" feature
  notifyWhenAvailable: {
    type: Boolean,
    default: false,
  },

}, { _id: false }); // sub-document, no separate _id needed

const wishlistSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Owner
    // ────────────────────────────────────────────────
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,             // one wishlist per user
      index: true,
    },

    // ────────────────────────────────────────────────
    // Items
    // ────────────────────────────────────────────────
    items: [wishlistItemSchema],

    // ────────────────────────────────────────────────
    // Meta / stats (updated automatically)
    // ────────────────────────────────────────────────
    itemCount: {
      type: Number,
      default: 0,
    },

    lastUpdated: Date,

    // Optional – for shared / public wishlists in future
    isPublic: {
      type: Boolean,
      default: false,
    },

    shareToken: {
      type: String,
      sparse: true,
      unique: true,
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

wishlistSchema.virtual('isEmpty').get(function () {
  return this.items.length === 0;
});

// ────────────────────────────────────────────────
// Indexes
// ────────────────────────────────────────────────

wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
