// models/WarehouseMovement.js — audit trail of warehouse stock changes
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseMovementSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size: { type: ObjectId, ref: 'Size', required: true },
    type: {
      type: String,
      enum: ['received', 'adjusted', 'shipped', 'transfer_in', 'transfer_out', 'returned'],
      required: true,
    },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, maxlength: 200 },
    transferGroupId: { type: ObjectId },
    performedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

warehouseMovementSchema.index({ tenant: 1, warehouse: 1, createdAt: -1 });
warehouseMovementSchema.index({ transferGroupId: 1 });

const WarehouseMovement =
  mongoose.models.WarehouseMovement ||
  mongoose.model('WarehouseMovement', warehouseMovementSchema);
module.exports = WarehouseMovement;
