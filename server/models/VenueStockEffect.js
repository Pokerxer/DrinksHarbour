'use strict';
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, billOrder: { type: Schema.Types.ObjectId, required: true },
  lineId: { type: String, required: true }, revision: { type: Number, required: true }, subproduct: { type: Schema.Types.ObjectId, required: true }, size: { type: Schema.Types.ObjectId, required: true }, product: Schema.Types.ObjectId,
  quantity: { type: Number, required: true, min: 1 }, state: { type: String, enum: ['reserved', 'consumed', 'released'], default: 'reserved' },
  costPolicyVersion: Number, valuationMethod: { type: String, enum: ['fifo', 'average'] },
  batchAllocations: [Schema.Types.Mixed], before: Number, after: Number, operationKey: String,
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, billOrder: 1, lineId: 1, revision: 1 }, { unique: true });
module.exports = mongoose.models.VenueStockEffect || mongoose.model('VenueStockEffect', schema);
