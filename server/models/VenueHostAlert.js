'use strict';
// models/VenueHostAlert.js — Phase-4 E2 Task 3: a VIP-arrival notification for the
// host floor, persisted POST-COMMIT (after the redemption transaction commits — an
// alert failure can never fail an admission) and emitted to the venue-host realtime
// room. PERMITTED INFO ONLY: permittedInfo {name, partySize, action} — never spend,
// never restrictedNote, never phone, never guest history (umbrella invariant 4).
// provenance {flaggedBy, reason, at} copies the guest list's VIP provenance triple.
// redemptionRef makes persistence IDEMPOTENT: a replayed redemption op re-runs the
// post-commit step, and the unique index turns the second insert into a no-op.
// acknowledgedBy/at record the host floor's acknowledgement. autoIndex: false;
// indexes ensured via audit-indexes (HOST_ALERT_MODEL_INDEXES).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', required: true },
  guestListRef: { type: Schema.Types.ObjectId, ref: 'VenueEventGuestList', default: null },
  redemptionRef: { type: Schema.Types.ObjectId, ref: 'VenueAdmissionRedemption', required: true },
  kind: { type: String, enum: { values: ['vip_arrival'], message: 'invalid kind' }, default: 'vip_arrival' },
  permittedInfo: new Schema({
    name: { type: String, required: true, maxlength: 120 },
    partySize: { type: Number, required: true, min: 1, max: 50 },
    action: { type: String, enum: { values: ['admitted', 're_entered'], message: 'invalid action' }, required: true },
  }, { _id: false }),
  provenance: new Schema({
    flaggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 300 },
    at: { type: Date, required: true },
  }, { _id: false }),
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, redemptionRef: 1 }, { unique: true });
schema.index({ tenant: 1, occurrence: 1, createdAt: -1 });
module.exports = mongoose.models.VenueHostAlert || mongoose.model('VenueHostAlert', schema);
