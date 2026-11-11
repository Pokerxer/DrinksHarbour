// models/TenantReview.js
//
// Customer ratings of a SELLER (an approved Tenant store) — separate from the
// Product Review model, which rates the central catalogue item. One tenant can
// sell many products and one product many tenants, so product reviews cannot
// answer "was this seller good to buy from?" — this model can.
//
// Mirrors the Product review rules: verified purchase (a delivered order that
// contained this tenant) and pending moderation before public display. The
// denormalised rating aggregate lives on Tenant.ratingAvg / Tenant.ratingCount
// and is recomputed whenever a review's status changes.

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const tenantReviewSchema = new Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    // The delivered order that proves the purchase (same rule as product reviews).
    order: {
      type: ObjectId,
      ref: 'Order',
      sparse: true,
    },

    // ────────────────────────────────────────────────
    // Review content
    // ────────────────────────────────────────────────
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    comment: {
      type: String,
      required: true,
      maxlength: 1200,
    },

    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },

    // ────────────────────────────────────────────────
    // Moderation (same lifecycle as Product reviews)
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending',
      index: true,
    },

    moderatedBy: {
      type: ObjectId,
      ref: 'User',
      sparse: true,
    },

    moderatedAt: Date,
    moderationNote: String,
  },
  {
    timestamps: true,
  }
);

// Public listing reads: this tenant's approved reviews, newest first.
tenantReviewSchema.index({ tenant: 1, status: 1, createdAt: -1 });
// One seller review per customer per store (checked in the controller too).
tenantReviewSchema.index({ user: 1, tenant: 1 }, { unique: true });

const TenantReview =
  mongoose.models.TenantReview || mongoose.model('TenantReview', tenantReviewSchema);

module.exports = TenantReview;
