'use strict';
const mongoose = require('mongoose'),
  { Schema } = mongoose,
  { sealed, common, rate, options } = require('./merchantCarrier.schema');
const schema = new Schema(
  {
    ...common,
    review: sealed(String),
    account: sealed(String, { match: /^[A-Z][A-Z0-9_]{0,59}$/ }),
    scopeHash: sealed(String),
    snapshot: sealed(Schema.Types.Mixed),
    requestToken: sealed(String, { maxlength: 512 }),
    rates: sealed([rate], { validate: (v) => Array.isArray(v) && v.length > 0 && v.length <= 100 }),
    expiresAt: sealed(Date),
    createdBy: sealed(Schema.Types.ObjectId),
  },
  options,
);
module.exports =
  mongoose.models.MerchantCarrierQuote || mongoose.model('MerchantCarrierQuote', schema);
