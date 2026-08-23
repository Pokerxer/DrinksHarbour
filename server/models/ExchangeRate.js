// models/ExchangeRate.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const exchangeRateSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    fromCurrency: {
      type: String,
      required: true,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      uppercase: true,
    },
    toCurrency: {
      type: String,
      required: true,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      uppercase: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ['manual', 'live'],
      default: 'manual',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

exchangeRateSchema.index({ tenant: 1, fromCurrency: 1, toCurrency: 1, effectiveDate: -1 });
exchangeRateSchema.index({ tenant: 1, isActive: 1, effectiveDate: -1 });

exchangeRateSchema.virtual('displayName').get(function() {
  return `${this.fromCurrency} → ${this.toCurrency}`;
});

exchangeRateSchema.methods.convert = function(amount) {
  return amount * this.rate;
};

exchangeRateSchema.statics.convertCurrency = async function(tenantId, amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  // Load every rate already in effect once and resolve in memory — direct,
  // inverse, then triangulated through the base currency. Mirrors the client
  // resolver (client/apps/admin/.../exchange-rates-helpers.ts) so a PO
  // converted server-side never disagrees with what analysis screens showed.
  const { resolveConversion } = require('../services/exchangeRates.helpers');

  const rows = await this.find(
    {
      tenant: tenantId,
      isActive: true,
      effectiveDate: { $lte: new Date() },
      $or: [
        { fromCurrency },
        { toCurrency: fromCurrency },
        { fromCurrency: toCurrency },
        { toCurrency: toCurrency },
      ],
    },
    'fromCurrency toCurrency rate -_id'
  ).sort({ effectiveDate: -1 });

  return resolveConversion(rows, fromCurrency, toCurrency);
};

const ExchangeRate = mongoose.models.ExchangeRate || mongoose.model('ExchangeRate', exchangeRateSchema);

module.exports = ExchangeRate;
