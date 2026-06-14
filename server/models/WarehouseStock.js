// models/WarehouseStock.js — stock of one size of one subproduct in one warehouse
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseStockSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size: { type: ObjectId, ref: 'Size', required: true, index: true },
    currentQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    zone: { type: String, maxlength: 20 },
    aisle: { type: String, maxlength: 20 },
    shelf: { type: String, maxlength: 20 },
    bin: { type: String, maxlength: 20 },
    minStockLevel: { type: Number, min: 0, default: 0 },
    maxStockLevel: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseStockSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, (this.currentQuantity || 0) - (this.reservedQuantity || 0));
});

warehouseStockSchema.index(
  { tenant: 1, warehouse: 1, subProduct: 1, size: 1 },
  { unique: true }
);
warehouseStockSchema.index({ tenant: 1, subProduct: 1 });

const WarehouseStock =
  mongoose.models.WarehouseStock || mongoose.model('WarehouseStock', warehouseStockSchema);
module.exports = WarehouseStock;
