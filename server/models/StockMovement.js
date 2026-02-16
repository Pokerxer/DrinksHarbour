// models/StockMovement.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const stockMovementSchema = new Schema(
  {
    size: {
      type: ObjectId,
      ref: 'Size',
      required: true,
      index: true,
    },
    subproduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['increase', 'decrease', 'adjustment', 'sale', 'return', 'damaged', 'transfer'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    oldStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    reference: {
      type: String,
      // Order ID, Purchase Order ID, etc.
    },
    performedBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ subproduct: 1, date: -1 });
stockMovementSchema.index({ type: 1, date: -1 });

const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
module.exports = StockMovement;