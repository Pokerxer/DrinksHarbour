'use strict';
// models/VenueWaitlistEntry.js — Phase-4 E3 Task 1: one waiting party on a
// location's (or occurrence's) waitlist. A waitlist entry is a REQUEST for a
// table — it is NEVER a booking, never an admission and never a charge (11 §3:
// "Waitlist invitation is not an automatic confirmed booking").
//
// Scope: occurrence-scoped when `occurrence` is set (validated against the E1
// occurrence in services/venue/waitlist.js — foreign occurrences 404), otherwise
// location-scoped. window {earliestAt, latestAt} carries explicit-UTC-offset
// instants validated at the service boundary (the validateRequest.bookingAt
// rule); Dates are stored UTC. verifiedContactRoute (sms|email|in_app) is
// RECORDED, NOT SENT — contact happens through the staff's existing channels;
// E3 sends no messages (provider messaging is out of scope, design §3).
//
// Uniqueness decision (documented, plan-delegated "decide sparse compound
// index"): the compound unique index is NOT sparse — {tenant, location,
// occurrence, phone} with occurrence defaulting to null. MongoDB treats a
// missing/null occurrence as null, so location-scoped rows group together
// (unique phone per LOCATION scope) while occurrence-scoped rows are unique per
// occurrence — exactly "unique phone per scope". A sparse index would silently
// drop location-scoped rows from the guard. autoIndex: false; indexes ensured
// via services/venue/audit-indexes.js (WAITLIST_MODEL_INDEXES).
//
// offer {at, expiresAt, claimRef, bookingRef} is the SINGLE active offer
// (E3 Task 2): claimRef is the REAL bounded capacity hold (VenueCapacityClaim,
// state 'held') and bookingRef the pending Booking it rides; expiry/acceptance
// semantics live in services/venue/waitlist.js and capacity-expiry.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', default: null },
  name: { type: String, required: true, maxlength: 120 },
  phone: { type: String, required: true, minlength: 7, maxlength: 20 },
  verifiedContactRoute: { type: String, enum: { values: ['sms', 'email', 'in_app'], message: 'invalid verifiedContactRoute' }, required: true },
  partySize: { type: Number, required: true, min: 1, max: 100 },
  window: { type: new Schema({ earliestAt: { type: Date, required: true }, latestAt: { type: Date, required: true } }, { _id: false }), required: true },
  acceptableZones: { type: [String], maxlength: 50, default: [] },
  state: { type: String, enum: { values: ['waiting', 'offered', 'accepted', 'declined', 'expired', 'cancelled'], message: 'invalid state' }, default: 'waiting' },
  offer: { type: new Schema({
    at: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    claimRef: { type: Schema.Types.ObjectId, ref: 'VenueCapacityClaim', required: true },
    bookingRef: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  }, { _id: false }), default: null },
  version: { type: Number, default: 0, min: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, autoIndex: false });
// Non-sparse (see header): location-scoped rows (occurrence null) group together.
schema.index({ tenant: 1, location: 1, occurrence: 1, phone: 1 }, { unique: true });
// Queue listing (state filter + insertion order).
schema.index({ tenant: 1, location: 1, state: 1 });
// The expiry sweep's offered-entry lookup (capacity-expiry.js, Task 2).
schema.index({ tenant: 1, 'offer.claimRef': 1, state: 1 });
module.exports = mongoose.models.VenueWaitlistEntry || mongoose.model('VenueWaitlistEntry', schema);
