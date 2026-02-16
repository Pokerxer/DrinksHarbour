// models/ShippingMethod.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const shippingMethodSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      sparse: true,                 // null = platform default
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    code: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_-]+$/,
    },

    description: {
      type: String,
      maxlength: 300,
    },

    // Delivery time estimate
    estimatedDeliveryDaysMin: {
      type: Number,
      min: 0,
    },

    estimatedDeliveryDaysMax: {
      type: Number,
      min: 0,
    },

    // Cost calculation
    pricingType: {
      type: String,
      enum: ['fixed', 'weight_based', 'price_based', 'free_above', 'custom'],
      default: 'fixed',
    },

    fixedPrice: {
      type: Number,
      min: 0,
    },

    freeAboveAmount: {
      type: Number,
      min: 0,
    },

    weightBasedRates: [{
      minWeightKg: Number,
      maxWeightKg: Number,
      price: Number,
    }],

    priceBasedRates: [{
      minOrderValue: Number,
      maxOrderValue: Number,
      price: Number,
    }],

    // Availability rules
    isActive: {
      type: Boolean,
      default: true,
    },

    allowedCountries: [String],     // e.g. ['NG']
    allowedStates: [String],        // e.g. ['Lagos', 'Abuja FCT', 'Rivers']

    // Pickup / in-store options
    isPickup: {
      type: Boolean,
      default: false,
    },

    pickupLocations: [{
      name: String,
      address: String,
      coordinates: { lat: Number, lng: Number },
    }],

    // Integration / third-party
    integrationType: {
      type: String,
      enum: ['internal', 'third_party', 'manual'],
      default: 'manual',
    },

    thirdPartyProvider: {
      type: String,
      enum: ['gokada', 'kwik', 'max.ng', 'other'],
      sparse: true,
    },

    displayOrder: {
      type: Number,
      default: 999,
    },

    createdBy: {
      type: ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
shippingMethodSchema.index({ tenant: 1, code: 1 }, { unique: true });
shippingMethodSchema.index({ tenant: 1, isActive: 1, displayOrder: 1 });
shippingMethodSchema.index({ isPickup: 1 });

const ShippingMethod = mongoose.models.ShippingMethod || mongoose.model('ShippingMethod', shippingMethodSchema);

module.exports = ShippingMethod;