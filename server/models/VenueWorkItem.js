'use strict';
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({ tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ['verify_payment', 'settle_bill', 'project_invoice', 'post_advance', 'money_resolution', 'cost_resolution'], required: true }, targetId: { type: Schema.Types.ObjectId, required: true }, dedupeKey: { type: String, required: true },
  reviewVersion: { type: Number, default: 0 }, costEvidence: Schema.Types.Mixed,
  state: { type: String, enum: ['pending', 'running', 'done', 'needs_review'], default: 'pending' }, attempts: { type: Number, default: 0 },
  nextRunAt: { type: Date, default: Date.now }, leaseUntil: { type: Date, default: null }, lastErrorCode: String, leaseToken: String,
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, kind: 1, dedupeKey: 1 }, { unique: true }); schema.index({ state: 1, nextRunAt: 1, leaseUntil: 1 });
module.exports = mongoose.models.VenueWorkItem || mongoose.model('VenueWorkItem', schema);
