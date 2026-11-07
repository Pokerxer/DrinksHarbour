'use strict';
const mongoose = require('mongoose');
const ref = name => ({ type: mongoose.Schema.Types.ObjectId, ref: name, required: true });
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  tenant: ref('Tenant'), order: ref('Order'), warehouse: ref('Warehouse'),
  subProduct: ref('SubProduct'), size: ref('Size'), product: ref('Product'),
  quantity: { type: Number, required: true, min: 1 },
  reservationVersion: { type: Number, enum: [2], immutable: true, default: undefined },
  merchantOrder: { type: String, immutable: true, default: undefined },
  fulfillmentLineId: { type: String, immutable: true, default: undefined },
  consumedQuantity: { type: Number, min: 0, default: undefined },
  releasedQuantity: { type: Number, min: 0, default: undefined },
  unitDispositions: { type: [{ start: Number, quantity: Number, action: { type: String, enum: ['consume', 'release'] }, allocation: String }], default: undefined },
  state: { type: String, enum: ['reserved', 'consumed', 'released'], required: true },
  batchAllocations: [{ batch: ref('WarehouseBatch'), quantity: { type: Number, required: true } }],
}, { timestamps: true });
schema.index({ tenant: 1, order: 1 });
module.exports = mongoose.models.OnlineStockReservation || mongoose.model('OnlineStockReservation', schema);
