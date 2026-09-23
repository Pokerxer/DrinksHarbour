const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  kiosk: { type: Schema.Types.ObjectId, ref: 'PriceCheckerKiosk', required: true },
  location: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  barcode: { type: String, required: true, maxlength: 128 },
  kioskName: String,
  firstSeen: Date,
  lastSeen: Date,
  count: { type: Number, default: 0 },
});
schema.index({ tenant: 1, kiosk: 1, location: 1, barcode: 1 }, { unique: true });
schema.index({ tenant: 1, lastSeen: -1 });
module.exports = mongoose.models.UnknownBarcodeScan || mongoose.model('UnknownBarcodeScan', schema);
