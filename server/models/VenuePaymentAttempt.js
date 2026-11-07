'use strict';
const { moneyModel } = require('./venueMoney.schema');
module.exports = moneyModel('VenuePaymentAttempt', {
  collectionVersion: { type: Number, enum: [1, 2], default: 1 },
  payerPortion: require('mongoose').Schema.Types.ObjectId, grantVersion: Number,
  collectionSlot: String, booking: require('mongoose').Schema.Types.ObjectId, payer: require('mongoose').Schema.Types.ObjectId,
  policySnapshot: require('mongoose').Schema.Types.Mixed, bookingReference: String,
  session: { type: require('mongoose').Schema.Types.ObjectId, required: function () { return this.purpose === 'venue_bill'; } },
  billOrder: { type: require('mongoose').Schema.Types.ObjectId, required: function () { return this.purpose === 'venue_bill'; } },
  method: { type: String, enum: ['cash', 'paystack'], required: true }, amountMinor: { type: Number, required: true }, currency: { type: String, enum: ['NGN'], default: 'NGN' },
  purpose: { type: String, enum: ['venue_bill', 'venue_deposit'], default: 'venue_bill' }, reference: { type: String, required: true },
  state: { type: String, enum: ['initializing', 'pending', 'verified', 'settled', 'failed', 'needs_review'], required: true },
  authorizationUrl: { type: String, select: false }, initializationStartedAt: { type: Date, default: null },
  providerTransactionId: String, receipt: require('mongoose').Schema.Types.ObjectId, actor: require('mongoose').Schema.Types.ObjectId,
  key: { type: String, required: true, maxlength: 128 }, requestHash: { type: String, required: true }, changeMinor: Number,
}, [[{ tenant: 1, billOrder: 1 }, { unique: true, name: 'venue_full_bill_attempt', partialFilterExpression: { collectionVersion: 1 } }], [{ tenant: 1, collectionSlot: 1 }, { unique: true, partialFilterExpression: { collectionSlot: { $type: 'string' } } }], [{ reference: 1 }, { unique: true }]]);
