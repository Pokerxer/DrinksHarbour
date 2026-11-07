'use strict';
// models/VenueEventOccurrence.js — Phase-4 E1: one dated occurrence of a recurring
// event slug at a location (spec §2 invariant 5; plan Task 1). occurrenceDate is the
// VENUE-LOCAL service date (clock.businessDate with the location timezone +
// businessDayStartMinutes): a Friday-night end that spills past midnight keeps the
// ORIGINAL Friday service date — the date is derived/validated in
// services/venue/events.js, never trusted from the client. startAt/endAt are UTC
// instants. capacity {maxGuests, maxTables?} is a LIMIT DEFINITION ONLY — it is never
// stock and never bypasses table capacity (umbrella invariant 1); consumption by
// admission commands is E2/E5. agePolicy is a published, versioned occurrence
// attribute (admissionTerms required, <=2000; minimumAge optional 16|18|21) enforced
// at entitlement issuance/redemption in later slices. publication is draft→published
// (versioned update) and published→cancelled ONLY via the explicit cancel operation
// (cancelledAt). Unique per {tenant, location, eventSlug, occurrenceDate}. autoIndex:
// false; indexes ensured via services/venue/audit-indexes.js (EVENT_MODEL_INDEXES).
//
// Phase-4 E2 additions: guestsAdmitted is THE shared-cap ledger counter (every
// admission mode — guest list, ticket, table inclusion, vip — atomically increments
// it under a $expr guard against capacity.maxGuests; re-entry rows never touch it);
// doorStaffIds[] are the ONLY actors whose door.scan/listDoorOccurrences calls are
// accepted for this occurrence (assignment enforced service-side); admissionPolicy
// {maxReEntries} is the per-token re-entry cap (0/absent = re-entry not permitted).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  eventSlug: { type: String, required: true },
  name: { type: String, required: true },
  occurrenceDate: { type: String, required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  room: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  capacity: new Schema({ maxGuests: { type: Number, required: true, min: 1 }, maxTables: { type: Number, min: 1 } }, { _id: false }),
  agePolicy: new Schema({
    minimumAge: { type: Number, enum: { values: [16, 18, 21], message: 'invalid minimumAge' } },
    admissionTerms: { type: String, required: true, maxlength: 2000 },
  }, { _id: false }),
  publication: { type: String, enum: { values: ['draft', 'published', 'cancelled'], message: 'invalid publication' }, default: 'draft' },
  guestsAdmitted: { type: Number, default: 0, min: 0 },
  doorStaffIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  admissionPolicy: { type: new Schema({ maxReEntries: { type: Number, default: 0, min: 0, max: 10 } }, { _id: false }), default: () => ({}) },
  version: { type: Number, default: 0, min: 0 },
  cancelledAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, location: 1, eventSlug: 1, occurrenceDate: 1 }, { unique: true });
schema.index({ tenant: 1, location: 1, occurrenceDate: -1, publication: 1 });
module.exports = mongoose.models.VenueEventOccurrence || mongoose.model('VenueEventOccurrence', schema);
