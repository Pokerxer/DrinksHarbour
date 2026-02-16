// models/Review.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const reviewSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Relationships
    // ────────────────────────────────────────────────
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // Optional: tenant context (useful for moderation or tenant-specific feedback)
    subproduct: {
      type: ObjectId,
      ref: 'SubProduct',
      sparse: true,
    },

    order: {
      type: ObjectId,
      ref: 'Order',
      sparse: true, // link to verified purchase
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

    // AI-generated sentiment (optional – stored after analysis)
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
    },

    // ────────────────────────────────────────────────
    // Media & verification
    // ────────────────────────────────────────────────
    images: [{
      url: String,
      publicId: String,
      alt: String,
    }],

    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },

    // ────────────────────────────────────────────────
    // Engagement & moderation
    // ────────────────────────────────────────────────
    helpfulCount: {
      type: Number,
      default: 0,
    },

    reportedCount: {
      type: Number,
      default: 0,
    },

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

// Compound indexes – very common queries
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // one review per user/product
reviewSchema.index({ rating: 1 });
reviewSchema.index({ helpfulCount: -1 });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;