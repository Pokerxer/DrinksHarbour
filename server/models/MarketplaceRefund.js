'use strict';
const mongoose = require('mongoose');
module.exports = mongoose.models.MarketplaceRefund || mongoose.model('MarketplaceRefund', new mongoose.Schema({
  _id: String, order: { type: mongoose.Schema.Types.ObjectId, required: true }, actor: mongoose.Schema.Types.ObjectId,
  amount: Number, currency: String, providerReference: String, refundId: String,
  state: { type: String, enum: ['pending', 'uncertain', 'succeeded'], required: true }, issue: String,
}, { timestamps: true }));
