'use strict';
const mongoose = require('mongoose');
const schema = require('./marketRevisionSchema')({
  mode: { type: String, enum: ['open', 'exclusive', 'closed'], required: true },
  exclusiveTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  exceptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
  contractReference: { type: String, required: true, maxlength: 1000 },
}, { market: 1, category: 1, channel: 1 });
module.exports = mongoose.models.MarketCategoryPolicy || mongoose.model('MarketCategoryPolicy', schema);
