'use strict';
// models/VenueWasteEvent.js — auditable waste/remake/return outcomes (S2).
// reason spills exactly as spec §2 lists it: spill | remake | supersed-portion | return-outcome.
// Waste drains an OpenedBottle (links consumptionEvent?) or discards sealed goods; it is
// separate from pours and requires approvedBy. autoIndex: false; indexes ensured via
// services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  consumptionEvent: Schema.Types.ObjectId, lineId: String,
  reason: { type: String, enum: { values: ['spill', 'remake', 'supersed-portion', 'return-outcome'], message: 'invalid waste reason' }, required: true },
  quantity: { type: Number, required: true }, unit: { type: String, enum: ['count', 'ml', 'g'], required: true },
  approvedBy: { type: Schema.Types.ObjectId, required: true }, policyConsentRef: String,
  actor: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, location: 1, createdAt: -1 });
module.exports = mongoose.models.VenueWasteEvent || mongoose.model('VenueWasteEvent', schema);
