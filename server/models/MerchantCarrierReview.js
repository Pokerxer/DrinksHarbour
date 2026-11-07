'use strict';
const mongoose = require('mongoose'),
  { Schema } = mongoose,
  { sealed, options } = require('./merchantCarrier.schema');
const positive = { validate: (v) => Number.isSafeInteger(v) && v > 0 };
const capabilities = new Schema(
  {
    alcohol: { type: Boolean, required: true },
    ageVerification: { type: Boolean, required: true },
    fragile: { type: Boolean, required: true },
  },
  { _id: false },
);
const pair = new Schema(
  {
    courierId: { type: String, required: true, match: /^[A-Za-z0-9_-]{1,80}$/ },
    serviceCode: { type: String, required: true, maxlength: 100 },
  },
  { _id: false },
);
const schema = new Schema(
  {
    _id: String,
    tenant: sealed(Schema.Types.ObjectId),
    location: sealed(Schema.Types.ObjectId),
    version: sealed(Number, positive),
    account: sealed(String, { match: /^[A-Z][A-Z0-9_]{0,59}$/ }),
    categoryId: sealed(Number, positive),
    allowedServices: sealed([pair], {
      validate: (v) => Array.isArray(v) && v.length > 0 && v.length <= 30,
    }),
    capabilities: sealed(capabilities),
    maxWeightGrams: sealed(Number, positive),
    maxUnits: sealed(Number, positive),
    reviewReference: sealed(String, { minlength: 5, maxlength: 500 }),
    validUntil: sealed(Date),
    status: { type: String, required: true, enum: ['reviewed', 'revoked'] },
    reviewedBy: sealed(Schema.Types.ObjectId),
    revokedBy: Schema.Types.ObjectId,
    revokedAt: Date,
    bookingGuard: { type: Number, default: 0 },
  },
  options,
);
module.exports =
  mongoose.models.MerchantCarrierReview || mongoose.model('MerchantCarrierReview', schema);
