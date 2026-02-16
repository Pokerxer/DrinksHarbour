// models/ScheduledPriceChange.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const scheduledPriceChangeSchema = new Schema(
  {
    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    currentPrice: {
      type: Number,
      min: 0,
    },

    newPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    effectiveDate: {
      type: Date,
      required: true,
      index: true,
    },

    scheduledBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'applied', 'cancelled', 'failed'],
      default: 'pending',
      index: true,
    },

    appliedAt: Date,

    appliedBy: {
      type: ObjectId,
      ref: 'User',
    },

    notes: String,

    error: String,
  },
  {
    timestamps: true,
  }
);

// Index for finding pending changes
scheduledPriceChangeSchema.index({ status: 1, effectiveDate: 1 });

const ScheduledPriceChange =
  mongoose.models.ScheduledPriceChange ||
  mongoose.model('ScheduledPriceChange', scheduledPriceChangeSchema);

module.exports = ScheduledPriceChange;