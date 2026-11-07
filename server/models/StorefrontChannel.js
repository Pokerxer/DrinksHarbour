'use strict';
const mongoose = require('mongoose');
const ref = name => ({ type: mongoose.Schema.Types.ObjectId, ref: name, required: true });
const schema = new mongoose.Schema({
  tenant: { ...ref('Tenant'), unique: true },
  apiKey: { ...ref('ApiKey'), unique: true },
  warehouse: ref('Warehouse'),
  code: { type: String, required: true, match: /^[A-Z][A-Z0-9_]{2,39}$/ },
  paymentAccount: { type: String, required: true, match: /^[A-Z][A-Z0-9_]{1,39}$/ },
  returnOrigins: { type: [String], required: true },
  enabled: { type: Boolean, default: false },
  configuredBy: ref('User'),
}, { timestamps: true });
module.exports = mongoose.models.StorefrontChannel || mongoose.model('StorefrontChannel', schema);
