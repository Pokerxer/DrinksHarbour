// models/PriceHistory.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const priceHistorySchema = new Schema(
  {
    subProduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },
    changes: {
      type: Schema.Types.Mixed,
      required: true,
      // Example: { costPrice: { old: 1000, new: 1200 }, baseSellingPrice: { old: 1500, new: 1800 } }
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    changedBy: {
      type: ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

priceHistorySchema.index({ subProduct: 1, changedAt: -1 });

const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory', priceHistorySchema);
module.exports = PriceHistory;