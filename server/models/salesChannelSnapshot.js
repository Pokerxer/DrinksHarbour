'use strict';
const { Schema } = require('mongoose');
const identity = new Schema({ type: String, reference: String }, { _id: false });
const payment = new Schema({ type: String, reference: String, provider: String, account: String }, { _id: false });
const pricing = new Schema({ code: String, version: Number, termsReference: String }, { _id: false });
const snapshot = new Schema({
  version: { type: Number, enum: [1], required: true },
  salesChannelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel' },
  configVersion: Number, countryVersion: Number,
  code: { type: String, required: true }, kind: { type: String, enum: ['marketplace', 'storefront', 'pos', 'venue'], required: true },
  market: { type: String, required: true }, currency: { type: String, required: true },
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  legalOwner: { type: identity, required: true }, paymentOwner: { type: payment, required: true }, pricingPolicy: { type: pricing, required: true },
  storefrontChannel: { type: Schema.Types.ObjectId, ref: 'StorefrontChannel' },
  apiKey: { type: Schema.Types.ObjectId, ref: 'ApiKey' }, location: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
}, { _id: false });

// Mongoose parent immutability alone does not protect dotted query updates.
function immutablePaths(schema) {
  schema.eachPath((name, path) => { path.immutable(true); if (path.schema) immutablePaths(path.schema); });
}
immutablePaths(snapshot);
module.exports = snapshot;
