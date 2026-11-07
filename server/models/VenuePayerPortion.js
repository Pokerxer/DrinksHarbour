'use strict';
const { Schema, model } = require('mongoose');
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, billOrder: { type: Schema.Types.ObjectId, required: true },
  amountMinor: { type: Number, required: true }, currency: { type: String, enum: ['NGN'], default: 'NGN' },
  state: { type: String, enum: ['reserved', 'pending', 'applied', 'failed', 'expired'], default: 'reserved' },
  payer: Schema.Types.ObjectId, attempt: Schema.Types.ObjectId, receipt: Schema.Types.ObjectId,
  expiresAt: { type: Date, required: true }, grantVersion: { type: Number, default: 0 },
  acceptedLines: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, billOrder: 1, state: 1, expiresAt: 1 });
module.exports = model('VenuePayerPortion', schema);
