'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  // Deterministic SHA-256 ID makes idempotency atomic even before secondary
  // indexes are built. It includes tenant and issuing key, not customer PII.
  _id: { type: String, required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  apiKey: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  fingerprint: { type: String, required: true, select: false },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  amountKobo: { type: Number, required: true },
  total: { type: Number, required: true },
  email: { type: String, required: true, select: false },
  returnUrl: { type: String, required: true, select: false },
  authorizationUrl: { type: String, select: false },
  state: { type: String, enum: ['pending', 'initializing', 'ready', 'uncertain', 'paid', 'cancelled', 'needs_review'], default: 'pending' },
  lastReconciledAt: Date,
  initializedAt: Date,
  settledAt: Date,
}, { timestamps: true });
schema.index({ tenant: 1, apiKey: 1, createdAt: -1 });
schema.index({ state: 1, createdAt: 1 });
module.exports = mongoose.models.IntegrationCheckout || mongoose.model('IntegrationCheckout', schema);
