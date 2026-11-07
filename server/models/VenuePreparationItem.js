'use strict';
// models/VenuePreparationItem.js — per-item preparation state ledger (S3, spec §2).
// NOT a second queue: each item references the fired round + line identity it came from
// (unique {tenant, lineId, revision} — a line/revision is fired in exactly one round, so
// this is the unique round+line join). Advancement appends stateHistory entries
// (append-only by construction) and NEVER touches stock or consumption. stationId absent
// = unrouted (surfaced, never silently lost). autoIndex: false; indexes ensured via
// services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const stateEntry = new Schema({
  from: { type: String, enum: ['pending', 'preparing', 'ready', 'served', null] }, to: { type: String, enum: ['pending', 'preparing', 'ready', 'served'], required: true },
  actor: { type: Schema.Types.ObjectId, required: true }, reason: String, ref: String, at: { type: Date, required: true },
}, { _id: false });
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, roundId: { type: Schema.Types.ObjectId, required: true },
  lineId: { type: String, required: true }, revision: { type: Number, required: true },
  name: String, quantity: Number,
  stationId: Schema.Types.ObjectId, firedAt: { type: Date, required: true },
  state: { type: String, enum: { values: ['pending', 'preparing', 'ready', 'served'], message: 'invalid preparation state' }, default: 'pending' },
  stateHistory: [stateEntry],
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, lineId: 1, revision: 1 }, { unique: true });
module.exports = mongoose.models.VenuePreparationItem || mongoose.model('VenuePreparationItem', schema);
