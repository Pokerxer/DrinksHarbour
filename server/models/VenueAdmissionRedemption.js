'use strict';
// models/VenueAdmissionRedemption.js — Phase-4 E2 Task 2: the append-only door
// ledger. kind 'entry' is unique per {tenant, token} via a PARTIAL unique index —
// exactly one entry row can ever exist for a token (duplicate-token prevention;
// concurrent scans: exactly one winner). kind 're-entry' rows reference the original
// entry (reEntryOf) and NEVER touch the shared cap: exiting guests re-enter within
// their original count, so guestsAdmitted keeps their admission from the entry row.
// guests is the EXACT consumed count (partial-party arrival: <= token partySize).
// autoIndex: false; indexes ensured via audit-indexes (ADMISSION_MODEL_INDEXES).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', required: true },
  entitlement: { type: Schema.Types.ObjectId, ref: 'VenueAdmissionEntitlement', required: true },
  token: { type: String, required: true, minlength: 8, maxlength: 64 },
  guests: { type: Number, required: true, min: 1, max: 50 },
  kind: { type: String, enum: { values: ['entry', 're-entry'], message: 'invalid kind' }, required: true },
  reEntryOf: { type: Schema.Types.ObjectId, ref: 'VenueAdmissionRedemption', default: null },
  at: { type: Date, default: () => new Date() },
  by: { type: Schema.Types.ObjectId, ref: 'User' },
  deviceId: { type: String, maxlength: 100, default: null },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, token: 1 }, { unique: true, partialFilterExpression: { kind: 'entry' } });
schema.index({ tenant: 1, occurrence: 1, _id: -1 });
module.exports = mongoose.models.VenueAdmissionRedemption || mongoose.model('VenueAdmissionRedemption', schema);
