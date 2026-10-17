const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model, required: true });
const schema = new Schema({
  tenant: ref('Tenant'), salesOrder: ref('SalesOrder'),
  lineId: { type: String, required: true }, warehouse: ref('Warehouse'),
  subProduct: ref('SubProduct'), size: ref('Size'),
  heldQty: { type: Number, min: 0, default: 0 },
  consumedQty: { type: Number, min: 0, default: 0 },
  releasedQty: { type: Number, min: 0, default: 0 },
}, { timestamps: true });
schema.index({ tenant:1, salesOrder:1, lineId:1, warehouse:1, size:1 }, { unique:true });
schema.index({ tenant:1, warehouse:1, subProduct:1, size:1, heldQty:1 });
module.exports = mongoose.models.SalesStockReservation || mongoose.model('SalesStockReservation', schema);
