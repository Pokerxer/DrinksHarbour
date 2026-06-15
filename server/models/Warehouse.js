// models/Warehouse.js — the physical place
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    type: {
      type: String,
      enum: ['warehouse', 'store', 'distribution_center'],
      default: 'warehouse',
    },
    address: {
      line1: { type: String, maxlength: 200 },
      line2: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      country: { type: String, maxlength: 100 },
      postalCode: { type: String, maxlength: 20 },
    },
    contact: {
      name: { type: String, maxlength: 120 },
      phone: { type: String, maxlength: 40 },
      email: { type: String, maxlength: 160, lowercase: true, trim: true },
    },
    notes: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseSchema.index({ tenant: 1, code: 1 }, { unique: true });
warehouseSchema.index({ tenant: 1, isActive: 1 });

const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
module.exports = Warehouse;
