'use strict';
// models/VenuePackageCommitment.js — Phase-4 E4 Task 2: a purchase's coordinated
// reservations. Created in ONE transaction: table claim (VenueCapacityClaim,
// state 'confirmed', anchored on THIS commitment's id — never a synthetic
// Booking row and never on the request queue), component stock reservations
// (WarehouseStock reservedQuantity increments on the SAME rows
// inventory.reserveBillStock guards), and the included-admissions entitlement
// (kind 'table_inclusion' → E2's shared-cap door ledger). Any failure rolls the
// whole transaction back (atomic all-or-nothing — 03 §7's two-phase "release
// the other" is superseded: partial states cannot arise mid-commit).
//
// state machine: 'committed' → 'released' (staff release; serves stay) —
// 'compensated' stays in the enum for operator reconciliation work only
// (compensation {state 'visible_pending'|'resolved', missing[]}, reachable
// through explicit operator action, never automatic).
//
// stockReservations consume: `consumed` counts PHYSICALLY served units per pair
// (decremented by package serves, never refunded — E5 refunds never restock
// served components). batchAllocations freeze the FEFO allocation made at
// commit; serves deplete FROM them (the reserveBillStock/consumeBillStock
// pattern) so batch-tracked stock can never split arbitrarily.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const reservation = new Schema({
  subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true },
  size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
  quantity: { type: Number, required: true, min: 1 },
  before: { type: Number, default: null }, batchAllocations: [Schema.Types.Mixed], consumed: { type: Number, default: 0 },
}, { _id: false });
const snapshotComponent = new Schema({
  subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true },
  size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', default: null },
  package: { type: Schema.Types.ObjectId, ref: 'VenueEventPackage', required: true },
  packageSnapshot: {
    _id: false,
    name: { type: String, required: true, maxlength: 120 },
    packageLine: { _id: false, subProduct: Schema.Types.ObjectId, size: Schema.Types.ObjectId },
    components: [snapshotComponent],
    includedAdmissions: { type: Number, default: 0, min: 0 },
    tablePlan: { _id: false, tableIds: [Schema.Types.ObjectId], seatCount: { type: Number, min: 1 } },
  },
  tableClaim: { type: Schema.Types.ObjectId, ref: 'VenueCapacityClaim', default: null },
  tableResources: [{ type: Schema.Types.ObjectId, ref: 'POSTable' }],
  admissionEntitlement: { type: Schema.Types.ObjectId, ref: 'VenueAdmissionEntitlement', default: null },
  stockReservations: [reservation],
  state: { type: String, enum: ['committed', 'compensated', 'released'], required: true, default: 'committed' },
  compensation: { type: { _id: false, state: String, missing: [String], resolvedAt: Date, resolvedBy: Schema.Types.ObjectId }, default: null },
  businessDate: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  releasedAt: Date, releasedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
module.exports = mongoose.models.VenuePackageCommitment || mongoose.model('VenuePackageCommitment', schema);
