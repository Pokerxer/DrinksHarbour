'use strict';
// S5 (spec §2.2): receipt-anchored gratuity ALLOCATION records. Records only —
// never a charge, refund, journal or stock effect, and never a mutation of the
// receipt or Order.tipAmount. One allocation per (tenant, receipt, sourceKind):
// 'pos' (the POS gratuity on the bill) and 'payer' (a post-payment tip
// collection) are separate anchors. The `allocations` rows are the staff/shift
// shares — exactly one of staffId/shiftId per row (XOR), validated in
// services/venue/gratuity.js. policyVersion names the APPROVED financial policy
// whose gratuityAllocation subdoc was read as a hint; rows come from the request.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, receiptId: { type: Schema.Types.ObjectId, required: true },
  sourceKind: { type: String, enum: ['pos', 'payer'], required: true },
  amountMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  policyVersion: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  allocations: [{ _id: false, staffId: Schema.Types.ObjectId, shiftId: Schema.Types.ObjectId, shareBps: { type: Number, required: true, min: 0 }, amountMinor: { type: Number, required: true, min: 0 } }],
  actor: { type: Schema.Types.ObjectId },
}, { timestamps: true, autoIndex: false, strict: 'throw' });
schema.index({ tenant: 1, receiptId: 1, sourceKind: 1 }, { unique: true });
// Listing surfaces are location/session scoped (tenant-prefixed for isolation).
schema.index({ tenant: 1, location: 1, session: 1 });
module.exports = mongoose.models.VenueGratuityAllocation || mongoose.model('VenueGratuityAllocation', schema);
