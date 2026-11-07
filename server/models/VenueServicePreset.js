'use strict';
// models/VenueServicePreset.js — server-owned location service policy (S3, spec §2).
// Presets carry configuration and opaque refs only: priceListRef/taxContextRef are stored
// verbatim (no price/tax math ever lives here) and prepSlotPolicy is recorded, not
// enforced (slot enforcement is Phase 5). allowedModes is exactly dine-in|counter_pickup —
// delivery is forbidden in S3. Unique per {tenant, location, name}; updates are versioned
// (optimistic expectedVersion) in services/venue/presets.js. autoIndex: false; indexes
// ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  allowedModes: { type: [{ type: String, enum: { values: ['dine-in', 'counter_pickup'], message: 'invalid allowedModes entry' } }], required: true },
  // hours/exceptions reuse the profile-hours shape validated by experience-validation
  hours: [{ day: Number, opens: String, closes: String, overnight: Boolean }],
  exceptions: [{ date: String, closed: Boolean, opens: String, closes: String, overnight: Boolean }],
  requiredGuestFields: { type: [{ type: String, enum: { values: ['name', 'phone', 'partySize'], message: 'invalid requiredGuestFields entry' } }], default: [] },
  paymentTiming: { type: String, enum: { values: ['deferred', 'per_order'], message: 'invalid paymentTiming' }, required: true },
  priceListRef: String, taxContextRef: String,
  prepSlotPolicy: new Schema({ maxConcurrent: Number, leadMins: Number }, { _id: false }),
  version: { type: Number, default: 0, min: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, location: 1, name: 1 }, { unique: true });
module.exports = mongoose.models.VenueServicePreset || mongoose.model('VenueServicePreset', schema);
