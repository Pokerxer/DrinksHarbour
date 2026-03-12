// models/ReorderRule.js

const mongoose = require('mongoose');

const reorderRuleSchema = new mongoose.Schema(
  {
    // Core relationships
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    subProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
    },

    // Rule name and description
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Trigger conditions
    triggerType: {
      type: String,
      enum: ['min_quantity', 'reorder_point', 'days_of_stock', 'forecast_based', 'manual'],
      default: 'reorder_point',
    },
    minQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    reorderPoint: {
      type: Number,
      min: 0,
      default: 10,
    },
    daysOfStock: {
      type: Number,
      min: 1,
      default: 14,
    },
    forecastDays: {
      type: Number,
      min: 1,
      default: 30,
    },

    // Order quantity settings
    quantityType: {
      type: String,
      enum: ['fixed', 'days_of_supply', 'economic_order_quantity', 'max_level', 'supplier_moq'],
      default: 'fixed',
    },
    orderQuantity: {
      type: Number,
      min: 1,
      default: 50,
    },
    maxStockLevel: {
      type: Number,
      min: 0,
    },
    daysOfSupply: {
      type: Number,
      min: 1,
      default: 30,
    },

    // Supplier/vendor information
    preferredVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    vendorName: String,
    leadTimeDays: {
      type: Number,
      min: 0,
      default: 7,
    },
    unitCost: {
      type: Number,
      min: 0,
    },
    minimumOrderQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },

    // Automation settings
    isAutomatic: {
      type: Boolean,
      default: false,
    },
    autoCreatePurchaseOrder: {
      type: Boolean,
      default: false,
    },
    autoApprove: {
      type: Boolean,
      default: false,
    },
    notifyOnTrigger: {
      type: Boolean,
      default: true,
    },
    notifyEmails: [String],

    // Schedule settings
    checkFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      default: 'daily',
    },
    lastCheckedAt: Date,
    nextCheckAt: Date,

    // Status tracking
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled'],
      default: 'active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: Date,
    triggerCount: {
      type: Number,
      default: 0,
    },

    // History of recent triggers
    recentTriggers: [{
      triggeredAt: Date,
      currentStock: Number,
      orderQuantity: Number,
      purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
      },
      status: {
        type: String,
        enum: ['pending', 'ordered', 'received', 'cancelled'],
      },
      notes: String,
    }],

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes
reorderRuleSchema.index({ tenant: 1, subProduct: 1 });
reorderRuleSchema.index({ tenant: 1, status: 1 });
reorderRuleSchema.index({ tenant: 1, isActive: 1, nextCheckAt: 1 });

// Virtual to check if rule should trigger
reorderRuleSchema.virtual('shouldTrigger').get(function() {
  // This would need current stock to be passed in or fetched
  return false;
});

// Method to check if rule should trigger based on current stock
reorderRuleSchema.methods.checkTrigger = function(currentStock, salesVelocity = 0) {
  switch (this.triggerType) {
    case 'min_quantity':
      return currentStock <= this.minQuantity;
    case 'reorder_point':
      return currentStock <= this.reorderPoint;
    case 'days_of_stock':
      if (salesVelocity <= 0) return false;
      const daysRemaining = currentStock / salesVelocity;
      return daysRemaining <= this.daysOfStock;
    case 'forecast_based':
      // Would need forecast data
      return currentStock <= this.reorderPoint;
    default:
      return false;
  }
};

// Method to calculate order quantity
reorderRuleSchema.methods.calculateOrderQuantity = function(currentStock, salesVelocity = 0) {
  switch (this.quantityType) {
    case 'fixed':
      return this.orderQuantity;
    case 'days_of_supply':
      return Math.ceil(salesVelocity * this.daysOfSupply);
    case 'max_level':
      return Math.max(0, (this.maxStockLevel || 100) - currentStock);
    case 'supplier_moq':
      return Math.max(this.orderQuantity, this.minimumOrderQuantity);
    case 'economic_order_quantity':
      // Simplified EOQ - would need demand and cost data
      return this.orderQuantity;
    default:
      return this.orderQuantity;
  }
};

// Method to trigger the rule
reorderRuleSchema.methods.trigger = async function(currentStock, orderQuantity, notes) {
  this.lastTriggeredAt = new Date();
  this.triggerCount += 1;
  
  this.recentTriggers.unshift({
    triggeredAt: new Date(),
    currentStock,
    orderQuantity,
    status: 'pending',
    notes,
  });
  
  // Keep only last 10 triggers
  if (this.recentTriggers.length > 10) {
    this.recentTriggers = this.recentTriggers.slice(0, 10);
  }
  
  await this.save();
  return this;
};

// Static method to find rules that need checking
reorderRuleSchema.statics.findDueForCheck = function(tenantId) {
  const now = new Date();
  return this.find({
    tenant: tenantId,
    status: 'active',
    isActive: true,
    $or: [
      { nextCheckAt: { $lte: now } },
      { nextCheckAt: null },
    ],
  }).populate('subProduct', 'sku totalStock availableStock salesVelocity');
};

const ReorderRule = mongoose.models.ReorderRule || mongoose.model('ReorderRule', reorderRuleSchema);
module.exports = ReorderRule;
