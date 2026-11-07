'use strict';
const { Schema, model } = require('mongoose');
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  booking: { type: Schema.Types.ObjectId, required: true, ref: 'Booking' },
  resources: [{ type: Schema.Types.ObjectId, ref: 'POSTable' }],
  start: { type: Date, required: true }, end: { type: Date, required: true }, bookingAt: { type: Date, required: true },
  state: { type: String, enum: ['held', 'confirmed', 'arrived', 'released', 'expired'], required: true },
  expiresAt: { type: Date, default: null }, version: { type: Number, default: 0 },
  policyVersion: { type: Number, required: true }, policySnapshot: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
schema.index({ tenant: 1, booking: 1 }, { unique: true });
schema.index({ tenant: 1, location: 1, resources: 1, start: 1, end: 1 });
module.exports = model('VenueCapacityClaim', schema);
