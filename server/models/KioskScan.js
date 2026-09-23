const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    kiosk: { type: Schema.Types.ObjectId, ref: 'PriceCheckerKiosk', required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    requestId: { type: String, required: true, maxlength: 80 },
    kioskName: String,
    shopId: String,
    barcode: { type: String, required: true, maxlength: 128 },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct' },
    size: { type: Schema.Types.ObjectId, ref: 'Size' },
    productName: String,
    found: { type: Boolean, required: true },
    outcome: {
      type: String,
      enum: ['FOUND', 'UNKNOWN', 'UNAVAILABLE', 'HIDDEN', 'PRICE_UNAVAILABLE', 'AMBIGUOUS'],
      required: true,
    },
    priceDisplayed: Number,
    currency: String,
    availability: String,
    availableQuantity: Number,
    scannedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
schema.index({ tenant: 1, kiosk: 1, requestId: 1 }, { unique: true });
schema.index({ tenant: 1, scannedAt: -1 });
schema.index({ tenant: 1, kiosk: 1, scannedAt: -1 });
schema.index({ tenant: 1, size: 1, scannedAt: -1 });
module.exports = mongoose.models.KioskScan || mongoose.model('KioskScan', schema);
