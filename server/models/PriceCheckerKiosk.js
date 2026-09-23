const mongoose = require('mongoose');
const { defaults, displayDefaults, currencies } = require('../services/priceChecker/validation');
const { Schema } = mongoose;
const settingFields = Object.fromEntries(
  Object.entries(displayDefaults).map(([key, value]) => [key, { type: Boolean, default: value }])
);
const settingsSchema = new Schema(
  {
    ...settingFields,
    resetSeconds: { type: Number, min: 3, max: 30, default: 8 },
    outOfStock: { type: String, enum: ['DISPLAY', 'HIDE', 'STAFF_MESSAGE'], default: 'DISPLAY' },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    ...Object.fromEntries(
      ['welcomeMessage', 'resultMessage', 'notFoundMessage', 'logo', 'background', 'accent'].map(
        (key) => [
          key,
          { type: String, default: defaults[key], maxlength: key === 'logo' ? 2048 : 300 },
        ]
      )
    ),
  },
  { _id: false }
);
const schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, maxlength: 120 },
    internalId: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, maxlength: 120, unique: true },
    shopId: { type: String, required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    pricelist: { type: Schema.Types.ObjectId, ref: 'Pricelist', default: null },
    currency: { type: String, enum: currencies, default: 'NGN' },
    mode: { type: String, enum: ['STORE_ONLY'], default: 'STORE_ONLY' },
    enabled: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);
schema.index({ tenant: 1, internalId: 1 }, { unique: true });
schema.index({ tenant: 1, enabled: 1 });
module.exports = mongoose.models.PriceCheckerKiosk || mongoose.model('PriceCheckerKiosk', schema);
