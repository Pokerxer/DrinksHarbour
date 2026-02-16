// models/Address.js  (or models/CustomerAddress.js)
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const addressSchema = new Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Label for user convenience (e.g. "Home", "Office", "Sister's place")
    label: {
      type: String,
      trim: true,
      maxlength: 50,
      default: 'Home',
    },

    // Core address fields – tailored for Nigeria + international support
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    addressLine2: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      // You can later add enum or validation against Nigerian states if desired
    },

    country: {
      type: String,
      required: true,
      default: 'Nigeria',
      enum: ['Nigeria', 'United Kingdom', 'United States', 'Ghana', 'South Africa'], // expand as needed
    },

    // Nigeria-specific or international postal/area code
    postalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    // Helpful for delivery riders in Nigeria
    landmark: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    // Very useful for Nigerian addresses (estate, close to, etc.)
    additionalInstructions: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // Default flags – only one shipping & one billing can be default
    isDefaultShipping: {
      type: Boolean,
      default: false,
    },

    isDefaultBilling: {
      type: Boolean,
      default: false,
    },

    // Optional – for future delivery partner integration
    coordinates: {
      type: { lat: Number, lng: Number },
      sparse: true,
    },

    // Status for soft-delete or invalidation
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },

    // Audit trail
    createdByIp: String, // optional – for fraud prevention
  },
  {
    timestamps: true,
  }
);

// Ensure only one default shipping & one default billing per user
addressSchema.index({ user: 1, isDefaultShipping: 1 });
addressSchema.index({ user: 1, isDefaultBilling: 1 });
addressSchema.index({ user: 1 });

const Address = mongoose.models.Address || mongoose.model('Address', addressSchema);

module.exports = Address;