'use strict';
const mongoose = require('mongoose');
module.exports = mongoose.models.CheckoutDebit || mongoose.model('CheckoutDebit', new mongoose.Schema({
  _id: String, user: { type: mongoose.Schema.Types.ObjectId, required: true }, method: String,
  channelSnapshot: { type: require('./salesChannelSnapshot'), immutable: true, default: undefined },
  reference: String, fingerprint: String, transaction: mongoose.Schema.Types.ObjectId, balance: Number, status: String,
}, { timestamps: true }));
