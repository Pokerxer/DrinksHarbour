'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { quantity, integer } = require('./venue-costing.schema');
const allocation = new Schema(
  {
    movementId: { type: Schema.Types.ObjectId, required: true },
    lotId: Schema.Types.ObjectId,
    receiptId: Schema.Types.ObjectId,
    quantity: { type: quantity, required: true },
    allocatedCostMinor: {
      type: Number,
      default: null,
      validate: (v) => v == null || (Number.isSafeInteger(v) && v >= 0),
    },
    valuationMethod: { type: String, enum: ['fifo', 'average'] },
    sourceTimestamp: Date,
  },
  { _id: false },
);
const schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, required: true },
    location: { type: Schema.Types.ObjectId, required: true },
    effectKey: { type: String, required: true },
    sourceKind: {
      type: String,
      enum: [
        'sealed_issue',
        'pour',
        'recipe_issue',
        'production_output',
        'waste',
        'adjustment',
      ],
      required: true,
    },
    sourceEvent: Schema.Types.ObjectId,
    session: Schema.Types.ObjectId,
    billOrder: Schema.Types.ObjectId,
    lineId: String,
    revision: Number,
    recipeVersionId: Schema.Types.ObjectId,
    quantity: { type: quantity, required: true },
    sourceAllocations: [allocation],
    amountMinor: {
      type: Number,
      default: null,
      validate: (v) => v == null || Number.isSafeInteger(v),
    },
    status: {
      type: String,
      enum: ['verified', 'estimated', 'mixed', 'unknown', 'review_required'],
      required: true,
    },
    missingReasons: [String],
    valuationMethod: { type: String, enum: ['fifo', 'average'] },
    currency: { type: String, enum: ['NGN'], default: 'NGN' },
    policyVersion: { type: Number, validate: integer },
    recordedAt: { type: Date, default: Date.now },
    adjustmentOf: Schema.Types.ObjectId,
    reason: String,
  },
  { autoIndex: false },
);
schema.index({ tenant: 1, effectKey: 1 }, { unique: true });
schema.pre('save', function () {
  if (!this.isNew)
    throw new Error('Cost evidence is immutable; append an adjustment');
  if (this.amountMinor < 0 && !this.adjustmentOf)
    throw new Error('Signed adjustment requires original evidence');
});
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
])
  schema.pre(operation, function () {
    throw new Error('Cost evidence is immutable');
  });
module.exports =
  mongoose.models.VenueCostSnapshot ||
  mongoose.model('VenueCostSnapshot', schema);
