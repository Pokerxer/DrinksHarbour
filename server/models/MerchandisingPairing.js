// server/models/MerchandisingPairing.js
// Tenant-configured manual upsell pairings ("buy X with Y"), Growth+ plans
// only (capability merchandising_manual). One row per tenant per source
// product; suggestions are central Product ids the tenant actually sells —
// the recommendation service re-verifies sellability before surfacing them.
const mongoose = require('mongoose');

const MerchandisingPairingSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    sourceProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    suggestedProducts: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      }],
      required: true,
      validate: {
        validator: function (list) {
          if (!Array.isArray(list) || list.length < 1 || list.length > 4) return false;
          const ids = list.map((id) => id?.toString());
          return new Set(ids).size === ids.length;
        },
        message: 'Suggested products must be 1–4 unique product references',
      },
    },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

MerchandisingPairingSchema.index({ tenant: 1, sourceProduct: 1 }, { unique: true });

module.exports = mongoose.model('MerchandisingPairing', MerchandisingPairingSchema);
