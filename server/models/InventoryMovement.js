// models/InventoryMovement.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const inventoryMovementSchema = new Schema(
  {
    // Core Relationships
    subProduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    product: {
      type: ObjectId,
      ref: 'Product',
    },
    size: {
      type: ObjectId,
      ref: 'Size',
    },
    warehouse: {
      type: ObjectId,
      ref: 'Warehouse',
    },

    // Movement Type
    type: {
      type: String,
      enum: [
        'received',
        'purchase',
        'return',
        'adjustment_in',
        'transfer_in',
        'sold',
        'shipped',
        'adjustment_out',
        'transfer_out',
        'damaged',
        'expired',
        'theft',
        'written_off',
        'reserved',
        'released',
      ],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['in', 'out', 'transfer', 'adjustment'],
      required: true,
    },

    // Quantity
    quantity: {
      type: Number,
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },

    // Reference Information
    reference: {
      type: String,
      maxlength: 100,
      comment: 'Order ID, PO number, transfer ID, etc.',
    },
    referenceType: {
      type: String,
      enum: ['order', 'purchase_order', 'transfer', 'return', 'adjustment', 'audit', 'manual', ''],
    },
    relatedOrder: {
      type: ObjectId,
      ref: 'Order',
    },
    relatedPurchaseOrder: {
      type: ObjectId,
      ref: 'PurchaseOrder',
    },

    // Cost & Value Tracking
    unitCost: {
      type: Number,
      min: 0,
      comment: 'Cost per unit at time of movement',
    },
    totalCost: {
      type: Number,
      min: 0,
      comment: 'Total cost (quantity * unitCost)',
    },
    sellingPrice: {
      type: Number,
      min: 0,
      comment: 'Selling price at time of sale',
    },

    // Location
    sourceWarehouse: {
      type: ObjectId,
      ref: 'Warehouse',
    },
    destinationWarehouse: {
      type: ObjectId,
      ref: 'Warehouse',
    },

    // Supplier/Vendor
    supplier: {
      type: ObjectId,
      ref: 'Vendor',
    },
    supplierName: {
      type: String,
      maxlength: 100,
    },

    // Batch & Lot Tracking
    batchNumber: {
      type: String,
      maxlength: 50,
    },
    lotNumber: {
      type: String,
      maxlength: 50,
    },
    expirationDate: {
      type: Date,
    },
    manufacturingDate: {
      type: Date,
    },

    // Reason/Notes
    reason: {
      type: String,
      maxlength: 200,
      comment: 'Reason for movement (e.g., "Inventory count", "Damaged goods")',
    },
    notes: {
      type: String,
      maxlength: 1000,
    },

    // Attachment/Proof
    attachments: [{
      url: String,
      type: {
        type: String,
        enum: ['image', 'document', 'receipt'],
      },
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],

    // Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'rejected'],
      default: 'confirmed',
      index: true,
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },

    // Performed By
    performedBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },

    // Source
    source: {
      type: String,
      enum: ['manual', 'api', 'system', 'order', 'return', 'transfer', 'sync'],
      default: 'manual',
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for profit (for sold items)
inventoryMovementSchema.virtual('profit').get(function () {
  if (this.type === 'sold' && this.sellingPrice && this.unitCost) {
    return (this.sellingPrice - this.unitCost) * this.quantity;
  }
  return 0;
});

// Virtual for revenue (for sold items)
inventoryMovementSchema.virtual('revenue').get(function () {
  if (this.type === 'sold' && this.sellingPrice) {
    return this.sellingPrice * this.quantity;
  }
  return 0;
});

// Static method to get inventory summary
inventoryMovementSchema.statics.getInventorySummary = async function (tenantId, subProductId, options = {}) {
  const { startDate, endDate, warehouseId } = options;
  
  const matchStage = {
    tenant: new ObjectId(tenantId),
  };
  
  if (subProductId) {
    matchStage.subProduct = new ObjectId(subProductId);
  }
  
  if (warehouseId) {
    matchStage.warehouse = new ObjectId(warehouseId);
  }
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 },
        totalCost: { $sum: '$totalCost' },
        totalRevenue: { $sum: '$revenue' },
        totalProfit: { $sum: '$profit' },
      },
    },
  ]);

  return summary;
};

// Static method to get stock flow
inventoryMovementSchema.statics.getStockFlow = async function (tenantId, subProductId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    {
      $match: {
        tenant: new ObjectId(tenantId),
        subProduct: new ObjectId(subProductId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type',
        },
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ];

  return this.aggregate(pipeline);
};

// Indexes
inventoryMovementSchema.index({ tenant: 1, subProduct: 1, createdAt: -1 });
inventoryMovementSchema.index({ tenant: 1, type: 1, createdAt: -1 });
inventoryMovementSchema.index({ tenant: 1, warehouse: 1, createdAt: -1 });
inventoryMovementSchema.index({ tenant: 1, reference: 1 });
inventoryMovementSchema.index({ subProduct: 1, batchNumber: 1 });
inventoryMovementSchema.index({ subProduct: 1, expirationDate: 1 });
inventoryMovementSchema.index({ performedBy: 1, createdAt: -1 });

const InventoryMovement = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema);

module.exports = InventoryMovement;
