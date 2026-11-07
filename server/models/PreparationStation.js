'use strict';
// models/PreparationStation.js — kitchen/station configuration for a location (S3, spec §2).
// categories are menu-item category matches; staffIds/deviceIds are opaque strings (no
// device drivers in S3 — S4 consumes them); stagePolicy holds allowed display label
// overrides only and never changes the semantic state set. isDefault marks the location's
// fallback station for unmapped categories (routing lands in S3 Task 4). autoIndex: false;
// indexes ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  categories: [String], categoryIds: {type:[String],default:undefined},
  staffIds: [String], deviceIds: [String],
  stagePolicy: Schema.Types.Mixed,
  alertThresholdMins: { type: Number, default: 15, min: 1 },
  isDefault: { type: Boolean, default: false },
  // Optimistic-concurrency version for config editing (batch-2 preset pattern).
  version: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, location: 1, name: 1 }, { unique: true });
module.exports = mongoose.models.PreparationStation || mongoose.model('PreparationStation', schema);
