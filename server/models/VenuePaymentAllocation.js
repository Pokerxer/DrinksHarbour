'use strict';
const { moneyModel, requiredId } = require('./venueMoney.schema');
module.exports = moneyModel('VenuePaymentAllocation', {
  collectionVersion: { type: Number, enum: [1, 2], default: 1 },
  kind: { type: String, enum: ['advance', 'bill'], default: 'bill' }, financialMinor: Number, taxMinor: Number, commissionMinor: Number, tenantMinor: Number,
  receipt: requiredId, amountMinor: { type: Number, required: true }, currency: { type: String, enum: ['NGN'], default: 'NGN' },
  key: { type: String, required: true }, appliedAt: { type: Date, required: true }, termsVersion: Number, rateBps: Number,
}, [[{ tenant: 1, receipt: 1, billOrder: 1, key: 1 }, { unique: true }], [{ tenant: 1, billOrder: 1 }, { unique: true, name: 'venue_full_bill_allocation', partialFilterExpression: { collectionVersion: 1 } }]]);
