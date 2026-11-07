'use strict';
const mongoose = require('mongoose');
module.exports = mongoose.models.OrderCheckoutRequest || mongoose.model('OrderCheckoutRequest', new mongoose.Schema({
  _id: String, fingerprint: String, requestFingerprint: String, order: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true }));
