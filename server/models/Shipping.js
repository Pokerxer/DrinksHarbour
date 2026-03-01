// models/Shipping.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const shippingSchema = new Schema(
  {
    // Core Relationships
    subProduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    product: {
      type: ObjectId,
      ref: 'Product',
    },

    // Dimensions (all in metric)
    weight: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Weight in grams',
    },
    length: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Length in cm',
    },
    width: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Width in cm',
    },
    height: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Height in cm',
    },

    // Volume calculation (computed)
    volume: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Volume in cubic cm (length x width x height)',
    },

    // Product-specific flags
    fragile: {
      type: Boolean,
      default: true,
    },
    requiresAgeVerification: {
      type: Boolean,
      default: true,
    },
    hazmat: {
      type: Boolean,
      default: false,
    },

    // Logistics classification
    shippingClass: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'freight', 'oversized', 'hazardous', ''],
      default: 'standard',
    },

    // Carrier information
    carrier: {
      type: String,
      maxlength: 100,
    },
    trackingUrl: {
      type: String,
      maxlength: 500,
    },

    // Delivery area restrictions
    deliveryArea: {
      type: String,
      maxlength: 100,
      comment: 'e.g., "Lagos Only", "Nationwide", "Abuja & Surround"',
    },
    allowedAreas: [{
      type: String,
    }],
    restrictedAreas: [{
      type: String,
    }],

    // Delivery time estimates
    minDeliveryDays: {
      type: Number,
      min: 0,
      default: 3,
    },
    maxDeliveryDays: {
      type: Number,
      min: 0,
      default: 7,
    },

    // Shipping cost configuration
    fixedShippingCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    isFreeShipping: {
      type: Boolean,
      default: false,
    },
    freeShippingMinOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
    freeShippingLabel: {
      type: String,
      maxlength: 50,
      default: 'Free Shipping',
    },

    // Weight-based shipping rates
    weightBasedRates: {
      type: Boolean,
      default: false,
    },
    weightRates: [{
      minWeight: Number,
      maxWeight: Number,
      rate: Number,
    }],

    // Price-based shipping rates
    priceBasedRates: {
      type: Boolean,
      default: false,
    },
    priceRates: [{
      minPrice: Number,
      maxPrice: Number,
      rate: Number,
    }],

    // Regional shipping rates
    regionalRates: [{
      area: String,
      minDeliveryDays: Number,
      maxDeliveryDays: Number,
      cost: Number,
    }],

    // Pickup options
    availableForPickup: {
      type: Boolean,
      default: false,
    },
    pickupLocations: [{
      name: String,
      address: String,
      city: String,
      state: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      operatingHours: String,
      contactPhone: String,
    }],

    // Additional options
    requiresSignature: {
      type: Boolean,
      default: false,
    },
    insuredShipping: {
      type: Boolean,
      default: false,
    },
    insuranceCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    handlingFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Packaging
    packagingType: {
      type: String,
      enum: ['box', 'envelope', 'pallet', 'crate', 'container', 'custom', ''],
      default: 'box',
    },
    packagingDescription: {
      type: String,
      maxlength: 200,
    },

    // Special handling instructions
    handlingInstructions: {
      type: String,
      maxlength: 500,
    },

    // Return shipping
    allowsReturns: {
      type: Boolean,
      default: true,
    },
    returnWindow: {
      type: Number,
      min: 0,
      default: 14,
      comment: 'Return window in days',
    },
    returnShippingCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },

    // Metadata
    notes: {
      type: String,
      maxlength: 1000,
    },
    createdBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for volumetric weight
shippingSchema.virtual('volumetricWeight').get(function () {
  if (this.length && this.width && this.height) {
    // Standard volumetric weight formula: (L x W x H) / 5000
    return (this.length * this.width * this.height) / 5000;
  }
  return 0;
});

// Virtual for chargeable weight (whichever is higher - actual or volumetric)
shippingSchema.virtual('chargeableWeight').get(function () {
  const volWeight = this.volumetricWeight || 0;
  return Math.max(this.weight || 0, volWeight);
});

// Method to calculate shipping cost
shippingSchema.methods.calculateShippingCost = function (orderWeight, orderValue, deliveryArea) {
  let cost = this.fixedShippingCost || 0;

  // Check for free shipping
  if (this.isFreeShipping && orderValue >= this.freeShippingMinOrder) {
    return 0;
  }

  // Weight-based calculation
  if (this.weightBasedRates && this.weightRates && this.weightRates.length > 0) {
    for (const rate of this.weightRates) {
      if (orderWeight >= rate.minWeight && (orderWeight <= rate.maxWeight || rate.maxWeight === null)) {
        cost = rate.rate;
        break;
      }
    }
  }

  // Price-based calculation
  if (this.priceBasedRates && this.priceRates && this.priceRates.length > 0) {
    for (const rate of this.priceRates) {
      if (orderValue >= rate.minPrice && (orderValue <= rate.maxPrice || rate.maxPrice === null)) {
        cost = rate.rate;
        break;
      }
    }
  }

  // Regional rate override
  if (deliveryArea && this.regionalRates && this.regionalRates.length > 0) {
    const regionalRate = this.regionalRates.find(function(r) { return r.area === deliveryArea; });
    if (regionalRate) {
      cost = regionalRate.cost;
    }
  }

  // Add handling fee
  cost += this.handlingFee || 0;

  // Add insurance if applicable
  if (this.insuredShipping) {
    cost += this.insuranceCost || 0;
  }

  return cost;
};

// Method to estimate delivery date
shippingSchema.methods.estimateDeliveryDate = function (deliveryArea) {
  deliveryArea = deliveryArea || null;
  const self = this;
  let minDays = self.minDeliveryDays || 3;
  let maxDays = self.maxDeliveryDays || 7;

  // Check regional rates for specific delivery time
  if (deliveryArea && self.regionalRates && self.regionalRates.length > 0) {
    const regionalRate = self.regionalRates.find(function(r) { return r.area === deliveryArea; });
    if (regionalRate) {
      minDays = regionalRate.minDeliveryDays || minDays;
      maxDays = regionalRate.maxDeliveryDays || maxDays;
    }
  }

  const now = new Date();
  const minDate = new Date(now);
  const maxDate = new Date(now);
  minDate.setDate(minDate.getDate() + minDays);
  maxDate.setDate(maxDate.getDate() + maxDays);

  return {
    minDate,
    maxDate,
    minDays,
    maxDays,
  };
};

// Indexes
shippingSchema.index({ tenant: 1, subProduct: 1 }, { unique: true });
shippingSchema.index({ tenant: 1, isActive: 1 });
shippingSchema.index({ subProduct: 1, isActive: 1 });

const Shipping = mongoose.models.Shipping || mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;
