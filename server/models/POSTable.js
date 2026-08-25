const mongoose = require('mongoose');
const { Schema } = mongoose;

const posTableSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    section: { type: String, trim: true, default: 'Main' },
    seats: { type: Number, default: 4, min: 1 },
    sortOrder: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'inactive'],
      default: 'available',
    },
    currentTabId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

posTableSchema.index({ tenant: 1, status: 1 });
posTableSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('POSTable', posTableSchema);
