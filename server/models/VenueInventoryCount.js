'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { quantity } = require('./venue-costing.schema');
const schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, required: true },
    location: { type: Schema.Types.ObjectId, required: true },
    countKey: { type: String, required: true },
    version: { type: Number, default: 0 },
    state: { type: String, enum: ['draft', 'completed'], default: 'draft' },
    observedAt: Date,
    cutoff: Date,
    completedAt: Date,
    createdBy: Schema.Types.ObjectId,
    reviewedBy: Schema.Types.ObjectId,
    scopeHash: String,
    movementWatermark: Schema.Types.ObjectId,
    completeness: {
      type: String,
      enum: ['complete', 'incomplete'],
      default: 'incomplete',
    },
    missingReasons: [String],
    items: [
      {
        subProductId: Schema.Types.ObjectId,
        sizeId: Schema.Types.ObjectId,
        quantity: { type: quantity, default: null },
        stockId: Schema.Types.ObjectId,
        stockUpdatedAt: Date,
        expectedQuantity: Number,
        valueMinor: { type: Number, default: null },
        valuationRefs: [Schema.Types.ObjectId],
        adjustmentRefs: [Schema.Types.ObjectId],
      },
    ],
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ tenant: 1, location: 1, countKey: 1 }, { unique: true });
schema.pre('save', function () {
  if (!this.isNew && this.$locals.wasCompleted)
    throw new Error('Completed counts are immutable');
});
schema.post('init', function (row) {
  row.$locals.wasCompleted = row.state === 'completed';
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
    throw new Error('Counts use the versioned command owner');
  });
module.exports =
  mongoose.models.VenueInventoryCount ||
  mongoose.model('VenueInventoryCount', schema);
