'use strict';
const mongoose = require('mongoose'),
  { Schema } = mongoose,
  { sealed, options } = require('./merchantCarrier.schema');
const schema = new Schema(
  {
    _id: String,
    booking: sealed(String),
    account: sealed(String),
    providerId: sealed(String),
    kind: sealed(String, { enum: ['identity'] }),
    evidenceHash: sealed(String),
  },
  options,
);
module.exports =
  mongoose.models.MerchantCarrierEvidence || mongoose.model('MerchantCarrierEvidence', schema);
