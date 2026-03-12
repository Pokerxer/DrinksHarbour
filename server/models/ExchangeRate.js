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
  
  const rate = await this.findOne({
    tenant: tenantId,
    fromCurrency,
    toCurrency,
    isActive: true,
    effectiveDate: { $lte: new Date() },
  }).sort({ effectiveDate: -1 });

  if (rate) {
    return amount * rate.rate;
  }

  const reverseRate = await this.findOne({
    tenant: tenantId,
    fromCurrency: toCurrency,
    toCurrency: fromCurrency,
    isActive: true,
    effectiveDate: { $lte: new Date() },
  }).sort({ effectiveDate: -1 });

  if (reverseRate) {
    return amount / reverseRate.rate;
  }

  return null;
};

const ExchangeRate = mongoose.models.ExchangeRate || mongoose.model('ExchangeRate', exchangeRateSchema);

module.exports = ExchangeRate;
