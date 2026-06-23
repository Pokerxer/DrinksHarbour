// models/WarehouseBatch.js — one batch (lot) of one size of one subproduct in one warehouse
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseBatchSchema = new Schema(
  {
    tenant:     { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse:  { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size:       { type: ObjectId, ref: 'Size', required: true, index: true },
    product:    { type: ObjectId, ref: 'Product' }, // denormalized for recall/lookup
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity:        { type: Number, min: 0, default: 0 },
    initialQuantity: { type: Number, min: 0, default: 0 },
    // Per-unit landed cost of this lot, captured at receipt. Drives weighted-
    // average and FIFO inventory valuation (warehouseSettings.valuationMethod).
    unitCost:        { type: Number, min: 0, default: 0 },
    expiryDate:   { type: Date, default: null },
    receivedDate: { type: Date, default: Date.now },
    // Quarantine state — set by the autoQuarantineExpired sweep once a lot
    // expires. Quarantined lots are excluded from picking and carved out of
    // available stock (via a WarehouseStock.reservedQuantity bump).
    quarantined:   { type: Boolean, default: false, index: true },
    quarantinedAt: { type: Date, default: null },
    sourcePO:     { type: ObjectId, ref: 'PurchaseOrder' },
    poNumber:     { type: String, maxlength: 50 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseBatchSchema.virtual('isDepleted').get(function () {
  return (this.quantity || 0) <= 0;
});

// One batch number per (warehouse, subProduct, size).
warehouseBatchSchema.index(
  { tenant: 1, warehouse: 1, subProduct: 1, size: 1, batchNumber: 1 },
  { unique: true }
);
// FEFO depletion lookups.
warehouseBatchSchema.index({ tenant: 1, warehouse: 1, subProduct: 1, size: 1, expiryDate: 1 });
// Cron expiry scan.
warehouseBatchSchema.index({ tenant: 1, expiryDate: 1, quantity: 1 });

const WarehouseBatch =
  mongoose.models.WarehouseBatch || mongoose.model('WarehouseBatch', warehouseBatchSchema);
module.exports = WarehouseBatch;
