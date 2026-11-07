'use strict';
// models/PreparationPrintJob.js — durable, ack-driven preparation print jobs
// (S4, spec §2). One collection, tenant-scoped, station-routed: jobs are the
// LEDGER of what the bridge should print and what it has acknowledged — they
// are created inside the fire transaction (a failed fire leaves no job),
// delivered only by pull (the bridge polls; the server never dials out) and
// acknowledged only through the bridge ack endpoint. Delivery state moves
// ONLY via the print-jobs service (never from timer assumptions).
// `duplicateOf` points at the original jobId for reprints (visibly labelled
// duplicates); recovery redelivery flags the RESPONSE, never the ledger.
// autoIndex: false; indexes ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, stationId: { type: Schema.Types.ObjectId, required: true },
  jobId: { type: String, required: true },
  lineIds: [String], roundId: Schema.Types.ObjectId,
  actionType: { type: String, enum: { values: ['print', 'reprint', 'amendment', 'cancel'], message: 'invalid print job action type' }, required: true },
  duplicateOf: String,
  // Frozen safe ticket snapshot (venue-prep room payload shape — no guest PII
  // beyond line data); immutable once written.
  payload: { type: Schema.Types.Mixed, immutable: true },
  deviceId: String,
  deliveryState: { type: String, enum: { values: ['queued', 'delivered', 'acknowledged', 'failed'], message: 'invalid delivery state' }, default: 'queued' },
  attempts: { type: Number, default: 0, min: 0 },
  ackAt: Date, lastDeliveredAt: Date, lastError: String,
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, jobId: 1 }, { unique: true });
module.exports = mongoose.models.PreparationPrintJob || mongoose.model('PreparationPrintJob', schema);
