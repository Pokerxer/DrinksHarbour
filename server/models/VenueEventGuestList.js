'use strict';
// models/VenueEventGuestList.js — Phase-4 E2 Task 1: one guest name (+ phone/party
// size) on one occurrence's door list. Lifecycle: requested → approved | denied;
// requested|approved → cancelled. Approval is the entitlement-ISSUANCE gate (E2):
// approve sets allowedCount ≤ partySize and a cutoffAt ≥ now — approval is NEVER a
// guarantee of admission (the redemption ledger enforces the shared cap). vip
// carries the provenance triple {reason, by, at} REQUIRED whenever flagged is true
// (validator below). promoterRef is OPAQUE attribution ({id, name}) — it never
// changes ownership or commission (umbrella invariant 4). restrictedNote is
// staff-only (never leaves staff surfaces). Unique {tenant, occurrence, phone} —
// one request per phone per occurrence. autoIndex: false; indexes ensured via
// services/venue/audit-indexes.js (GUESTLIST_MODEL_INDEXES).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', required: true },
  name: { type: String, required: true, maxlength: 120 },
  phone: { type: String, required: true, minlength: 7, maxlength: 20 },
  partySize: { type: Number, required: true, min: 1, max: 50 },
  state: { type: String, enum: { values: ['requested', 'approved', 'denied', 'cancelled'], message: 'invalid state' }, default: 'requested' },
  allowedCount: { type: Number, min: 0, max: 50, default: null },
  cutoffAt: { type: Date, default: null },
  promoterRef: new Schema({ id: { type: String, required: true, maxlength: 100 }, name: { type: String, required: true, maxlength: 120 } }, { _id: false }),
  assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  vip: { type: new Schema({
    flagged: { type: Boolean, default: false },
    reason: { type: String, maxlength: 300, default: null },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: null },
  }, { _id: false }), default: () => ({}) },
  restrictedNote: { type: String, maxlength: 500, default: null },
  version: { type: Number, default: 0, min: 0 },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, occurrence: 1, phone: 1 }, { unique: true });
schema.index({ tenant: 1, location: 1, occurrence: 1, state: 1 });
schema.pre('validate', function vipProvenance() {
  if (this.vip && this.vip.flagged) {
    if (!this.vip.reason) this.invalidate('vip.reason', 'A flagged VIP guest needs a reason', this.vip.reason);
    if (!this.vip.by) this.invalidate('vip.by', 'A flagged VIP guest needs the flagging staff member', this.vip.by);
    if (!this.vip.at) this.invalidate('vip.at', 'A flagged VIP guest needs the flagging time', this.vip.at);
  }
});
module.exports = mongoose.models.VenueEventGuestList || mongoose.model('VenueEventGuestList', schema);
