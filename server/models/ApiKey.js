'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 80 },
  prefix: { type: String, required: true },
  hash: { type: String, required: true, unique: true, select: false },
  scopes: { type: [String], required: true },
  revokedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  rateWindow: { type: Number, default: 0 },
  rateCount: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.models.ApiKey || mongoose.model('ApiKey', schema);
