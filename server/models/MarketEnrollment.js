'use strict';
const mongoose = require('mongoose');
const schema = require('./marketRevisionSchema')({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], required: true },
  statement: { type: String, required: true, maxlength: 1000 },
}, { tenant: 1, market: 1, category: 1, channel: 1 });
module.exports = mongoose.models.MarketEnrollment || mongoose.model('MarketEnrollment', schema);
