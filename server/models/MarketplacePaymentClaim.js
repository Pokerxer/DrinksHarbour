'use strict';
const mongoose = require('mongoose');
// _id is the durable unique provider/account/reference identity. Never TTL/delete receipts.
const schema = new mongoose.Schema({
  _id: String, provider: { type: String, required: true }, account: { type: String, default: 'platform' },
  reference: { type: String, required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true }, currency: { type: String, required: true },
  state: { type: String, enum: ['initializing', 'ready', 'uncertain', 'allocated', 'needs_review'], required: true },
  requestFingerprint: String, expiresAt: Date, order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, fingerprint: String,
  channelSnapshot: { type: require('./salesChannelSnapshot'), immutable: true, default: undefined },
  initialization: { type: mongoose.Schema.Types.Mixed },
  receipt: { type: mongoose.Schema.Types.Mixed }, issue: String,
}, { timestamps: true });
module.exports = mongoose.models.MarketplacePaymentClaim || mongoose.model('MarketplacePaymentClaim', schema);
