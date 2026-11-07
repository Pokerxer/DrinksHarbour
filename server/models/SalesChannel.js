'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const owner = new Schema({ type: { type: String, enum: ['tenant', 'platform'], required: true }, reference: { type: String, required: true } }, { _id: false });
const paymentOwner = new Schema({ type: { type: String, enum: ['tenant', 'platform'], required: true }, reference: { type: String, required: true }, provider: { type: String, enum: ['paystack', 'korapay', 'stripe', 'wallet', 'gift_card', 'cash_on_delivery', 'bank_transfer', 'cash', 'manual'], required: true }, account: { type: String, required: true } }, { _id: false });
const pricingPolicy = new Schema({ code: { type: String, required: true }, version: { type: Number, required: true, min: 1 }, termsReference: { type: String, required: true } }, { _id: false });
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, immutable: true },
  code: { type: String, required: true, immutable: true },
  kind: { type: String, enum: ['marketplace', 'storefront', 'pos', 'venue'], required: true, immutable: true },
  market: { type: String, required: true, immutable: true },
  currency: { type: String, required: true }, active: { type: Boolean, required: true, default: false },
  legalOwner: { type: owner, required: true }, paymentOwner: { type: paymentOwner, required: true }, allowedPaymentOwners: { type: [paymentOwner], default: undefined }, pricingPolicy: { type: pricingPolicy, required: true },
  storefrontChannel: { type: Schema.Types.ObjectId, ref: 'StorefrontChannel', immutable: true },
  apiKey: { type: Schema.Types.ObjectId, ref: 'ApiKey', immutable: true },
  location: { type: Schema.Types.ObjectId, ref: 'Warehouse', immutable: true },
  version: { type: Number, required: true, default: 1, min: 1 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewReason: { type: String, required: true },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, kind: 1, market: 1 }, { unique: true });
schema.index({ code: 1 }, { unique: true });
module.exports = mongoose.models.SalesChannel || mongoose.model('SalesChannel', schema);
