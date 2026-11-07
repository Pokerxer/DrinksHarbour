'use strict';
const { moneyModel, requiredId } = require('./venueMoney.schema');
module.exports = moneyModel('VenuePaymentReceipt', {
  collectionVersion: { type: Number, enum: [1, 2], default: 1 },
  purpose: { type: String, enum: ['venue_bill', 'venue_deposit'], default: 'venue_bill' },
  booking: require('mongoose').Schema.Types.ObjectId, payer: require('mongoose').Schema.Types.ObjectId,
  policySnapshot: require('mongoose').Schema.Types.Mixed, unappliedMinor: { type: Number, default: 0 },
  appliedRefundedMinor: { type: Number, default: 0 },
  refundedMinor: { type: Number, default: 0 }, refundReservedMinor: { type: Number, default: 0 },
  resolution: { type: String, enum: ['none', 'paid_needs_resolution', 'excess_credit'], default: 'none' },
  session: { type: require('mongoose').Schema.Types.ObjectId, required: function () { return this.purpose === 'venue_bill'; } },
  billOrder: { type: require('mongoose').Schema.Types.ObjectId, required: function () { return this.purpose === 'venue_bill'; } },
  attempt: requiredId, provider: { type: String, enum: ['cash', 'paystack'], required: true }, reference: { type: String, required: true }, providerTransactionId: String,
  amountMinor: { type: Number, required: true }, currency: { type: String, enum: ['NGN'], default: 'NGN' }, verifiedAt: { type: Date, required: true }, paidAt: Date,
  state: { type: String, enum: ['verified', 'applied', 'needs_review'], default: 'verified' }, appliedMinor: { type: Number, default: 0 },
}, [[{ attempt: 1 }, { unique: true }], [{ provider: 1, providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: 'string' } } }], [{ provider: 1, reference: 1 }, { unique: true }]]);
