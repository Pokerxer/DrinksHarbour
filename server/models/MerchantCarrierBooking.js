'use strict';
const mongoose = require('mongoose'),
  { Schema } = mongoose,
  { sealed, common, rate, options } = require('./merchantCarrier.schema');
const schema = new Schema(
  {
    _id: String,
    ...common,
    quote: sealed(Schema.Types.ObjectId),
    account: sealed(String, { match: /^[A-Z][A-Z0-9_]{0,59}$/ }),
    review: sealed(String),
    fingerprint: sealed(String),
    scopeHash: sealed(String),
    rate: sealed(rate),
    snapshot: sealed(Schema.Types.Mixed),
    state: {
      type: String,
      required: true,
      enum: [
        'submitting',
        'uncertain',
        'booked',
        'cancel_pending',
        'cancel_requested',
        'cancelled',
      ],
    },
    providerId: { type: String, match: /^SB-[A-Z0-9]{1,80}$/ },
    providerStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'picked_up', 'in_transit', 'completed', 'cancelled'],
    },
    scheduledFor: { type: Date, required: true, immutable: true },
    createdBy: sealed(Schema.Types.ObjectId),
    lastObservedAt: Date,
    cancelKey: String,
  },
  options,
);
module.exports =
  mongoose.models.MerchantCarrierBooking || mongoose.model('MerchantCarrierBooking', schema);
