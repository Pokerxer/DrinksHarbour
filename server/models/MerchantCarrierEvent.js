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
    kind: sealed(String, { enum: ['authenticated_tracking', 'callback'] }),
    status: {
      type: String,
      immutable: true,
      enum: ['pending', 'confirmed', 'picked_up', 'in_transit', 'completed', 'cancelled'],
    },
  },
  options,
);
module.exports =
  mongoose.models.MerchantCarrierEvent || mongoose.model('MerchantCarrierEvent', schema);
