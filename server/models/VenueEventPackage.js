'use strict';
// models/VenueEventPackage.js — Phase-4 E4 Task 1: the package DEFINITION.
//
// A package is a versioned offer: the sellable package line (a tenant SubProduct
// eligible in venue service), ≤12 physical components (track bottles/mixers
// per 03 §7 — "included" items are tracked, never untracked free stock), an
// optional included-admissions count (redeemed through the E2 shared-cap
// entitlement path) and a table plan ({tableIds[]} explicit pick OR {seatCount}
// first-fit at commit — both optional; neither = no table reservation).
// Definitions carry NO reservations: commits snapshot the definition into
// VenuePackageCommitment rows (VenueEventPackage stays re-editable).
//
// autoIndex: false; indexes ensured via services/venue/audit-indexes.js
// (PACKAGE_MODEL_INDEXES): unique {tenant, location, name} + the active listing.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const component = new Schema({
  subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true },
  size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', default: null },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  packageSubProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true },
  size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
  components: { type: [component], validate: [{ validator: v => v.length <= 12, message: 'A package carries at most 12 components' }] },
  includedAdmissions: { type: Number, default: 0, min: 0 },
  tablePlan: {
    _id: false,
    tableIds: [{ type: Schema.Types.ObjectId, ref: 'POSTable' }],
    seatCount: { type: Number, min: 1 },
  },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
schema.index({ tenant: 1, location: 1, name: 1 }, { unique: true });
module.exports = mongoose.models.VenueEventPackage || mongoose.model('VenueEventPackage', schema);
