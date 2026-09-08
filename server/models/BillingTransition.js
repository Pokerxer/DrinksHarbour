'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  operationId: { type: String, default: () => require('node:crypto').randomUUID(), required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  targetPlan: { type: String, required: true },
  oldCode: { type: String, required: true },
  newCode: String,
  creationStartedAt: Date,
  effectiveAt: { type: Date, required: true },
  state: { type: String, enum: ['preparing', 'creating', 'scheduled', 'needs_review', 'complete'], required: true },
  reason: String,
}, { timestamps: true });
module.exports = mongoose.models.BillingTransition || mongoose.model('BillingTransition', schema);
