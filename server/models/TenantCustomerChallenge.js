'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['verify', 'reset', 'mfa'], required: true },
    valueHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('TenantCustomerChallenge', schema);
