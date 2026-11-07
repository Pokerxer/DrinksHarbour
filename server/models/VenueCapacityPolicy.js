'use strict';
const { Schema, model } = require('mongoose');
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  financialPolicyVersion: { type: Number, default: null },
  version: { type: Number, required: true }, enabled: { type: Boolean, default: false },
  timezone: { type: String, required: true }, resources: [{ type: Schema.Types.ObjectId, ref: 'POSTable' }],
  combinations: [[Schema.Types.ObjectId]], windows: [{ _id: false, start: Date, end: Date }],
  durationMinutes: Number, bufferBeforeMinutes: Number, bufferAfterMinutes: Number, holdSeconds: Number,
  lockVersion: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
schema.index({ tenant: 1, location: 1 }, { unique: true });
module.exports = model('VenueCapacityPolicy', schema);
