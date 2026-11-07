'use strict';
const mongoose = require('mongoose');
module.exports = mongoose.models.StoredValueFunding || mongoose.model('StoredValueFunding', new mongoose.Schema({
  _id: String, provider: String, reference: String, user: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: Number, currency: String, kind: String, target: mongoose.Schema.Types.ObjectId,
  state: { type: String, enum: ['initializing', 'ready', 'uncertain', 'credited'] }, transaction: mongoose.Schema.Types.ObjectId,
  issue: String,
}, { timestamps: true }));
