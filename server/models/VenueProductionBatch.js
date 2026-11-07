'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { quantity } = require('./venue-costing.schema');
const schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, required: true },
    location: { type: Schema.Types.ObjectId, required: true },
    productionKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    version: { type: Number, default: 0 },
    state: {
      type: String,
      enum: ['draft', 'reserved', 'completed', 'cancelled'],
      default: 'draft',
    },
    output: { subProduct: Schema.Types.ObjectId, size: Schema.Types.ObjectId },
    recipeVersionId: Schema.Types.ObjectId,
    expectedOutput: quantity,
    actualOutput: quantity,
    reservations: [Schema.Types.Mixed],
    sourceCostMinor: Number,
    outputCostMinor: Number,
    lossCostMinor: Number,
    outputBatchId: Schema.Types.ObjectId,
    costSnapshotId: Schema.Types.ObjectId,
    journalId: Schema.Types.ObjectId,
    waste: Schema.Types.Mixed,
    createdBy: Schema.Types.ObjectId,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ tenant: 1, productionKey: 1 }, { unique: true });
schema.post('init', (row) => {
  row.$locals.terminal = ['completed', 'cancelled'].includes(row.state);
});
schema.pre('save', function () {
  if (!this.isNew && this.$locals.terminal)
    throw new Error('Terminal production is immutable');
});
module.exports =
  mongoose.models.VenueProductionBatch ||
  mongoose.model('VenueProductionBatch', schema);
