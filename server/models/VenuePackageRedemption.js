'use strict';
// models/VenuePackageRedemption.js — Phase-4 E4 Task 2: the per-component
// serve ledger. EVERY included component handed to a table is a tracked redemption
// row ("an included bottle is never an untracked free item", 03 §7): unique
// {tenant, commitment, componentIndex, sequence} bounds each component's serves
// at the snapshot quantity (COMPONENT_EXHAUSTED beyond it) and makes a serve
// exactly-once via the operation replay. movements carries the shipped
// Warehouse/Inventory movement rows created inside the serve transaction.
// The S2 VenueConsumptionEvent ledger stays bill-line-anchored (session+billOrder
// required by schema) — the redemption row IS the package ledger; never
// double-consumed (stock decrements happen here and only here).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  commitment: { type: Schema.Types.ObjectId, ref: 'VenuePackageCommitment', required: true },
  componentIndex: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  sequence: { type: Number, required: true, min: 1 },
  movements: [{ type: Schema.Types.ObjectId }], batchAllocations: [Schema.Types.Mixed],
  by: { type: Schema.Types.ObjectId, required: true }, at: { type: Date, default: Date.now },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
module.exports = mongoose.models.VenuePackageRedemption || mongoose.model('VenuePackageRedemption', schema);
