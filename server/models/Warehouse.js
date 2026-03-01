// models/Warehouse.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseSchema = new Schema(
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

    // Warehouse Location (Physical)
    location: {
      type: String,
      maxlength: 100,
      comment: 'e.g., "Main Warehouse", "Store Front", "Distribution Center A"',
    },
    locationType: {
      type: String,
      enum: ['warehouse', 'store', 'distribution_center', 'supplier', 'transit', 'custom'],
      default: 'warehouse',
    },

    // Bin Location Details
    zone: {
      type: String,
      maxlength: 20,
      comment: 'e.g., "A", "B", "C"',
    },
    aisle: {
      type: String,
      maxlength: 20,
      comment: 'e.g., "1", "2", "3"',
    },
    shelf: {
      type: String,
      maxlength: 20,
      comment: 'e.g., "A", "B", "Top", "Bottom"',
    },
    bin: {
      type: String,
      maxlength: 20,
      comment: 'e.g., "1", "2", "3", "Left", "Right"',
    },

    // Full location path (computed)
    fullLocation: {
      type: String,
      maxlength: 200,
    },

    // Barcode / QR code for location scanning
    locationBarcode: {
      type: String,
      maxlength: 50,
    },
    locationQrCode: {
      type: String,
      maxlength: 100,
    },

    // Storage Capacity
    capacity: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Maximum units that can be stored in this location',
    },
    currentQuantity: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Current stock in this location',
    },
    reservedQuantity: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Reserved quantity (pending orders)',
    },
    availableCapacity: {
      type: Number,
      min: 0,
      comment: 'Available space (capacity - currentQuantity)',
    },

    // Storage Conditions
    condition: {
      type: String,
      enum: ['ambient', 'refrigerated', 'frozen', 'climate_controlled', 'dark_storage', 'ventilated'],
      default: 'ambient',
    },
    temperature: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius',
      },
    },
    humidityLevel: {
      type: Number,
      min: 0,
      max: 100,
      comment: 'Humidity percentage',
    },
    isLightSensitive: {
      type: Boolean,
      default: false,
    },

    // Stock Level Alerts
    minStockLevel: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Alert when stock falls below this',
    },
    maxStockLevel: {
      type: Number,
      min: 0,
      default: 0,
      comment: 'Alert when stock exceeds this',
    },
    reorderAlert: {
      type: Boolean,
      default: true,
    },

    // Expiration Tracking
    trackExpiration: {
      type: Boolean,
      default: false,
    },
    expirationWarningDays: {
      type: Number,
      min: 0,
      default: 30,
      comment: 'Warn this many days before expiration',
    },

    // Inventory Management
    binManagement: {
      type: String,
      enum: ['single_bin', 'multi_bin', 'lot_tracking', 'serialized'],
      default: 'single_bin',
    },
    lotNumber: {
      type: String,
      maxlength: 50,
    },
    batchNumber: {
      type: String,
      maxlength: 50,
    },

    // Picking Information
    pickPriority: {
      type: Number,
      default: 999,
      comment: 'Lower = higher priority for picking',
    },
    pickZone: {
      type: String,
      maxlength: 20,
    },
    pickPath: {
      type: String,
      maxlength: 50,
      comment: 'Optimized picking path order',
    },

    // Accessibility
    isAccessible: {
      type: Boolean,
      default: true,
    },
    accessNotes: {
      type: String,
      maxlength: 200,
      comment: 'Notes about accessibility (e.g., "Forklift required")',
    },

    // Count & Audit
    lastCountDate: {
      type: Date,
    },
    lastCycleCount: {
      type: Number,
      default: 0,
    },
    countVariance: {
      type: Number,
      default: 0,
    },

    // Movement History
    movements: [{
      date: Date,
      type: {
        type: String,
        enum: ['received', 'shipped', 'adjusted', 'transferred', 'returned', 'damaged', 'expired'],
      },
      quantity: Number,
      reference: String,
      notes: String,
      performedBy: {
        type: ObjectId,
        ref: 'User',
      },
    }],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance', 'full', 'reserved'],
      default: 'active',
    },

    // Metadata
    notes: {
      type: String,
      maxlength: 1000,
    },
    createdBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for available capacity
warehouseSchema.virtual('availableSpace').get(function () {
  return (this.capacity || 0) - (this.currentQuantity || 0);
});

// Virtual for fill percentage
warehouseSchema.virtual('fillPercentage').get(function () {
  if (!this.capacity || this.capacity === 0) return 0;
  return ((this.currentQuantity || 0) / this.capacity) * 100;
});

// Pre-save middleware to compute full location
warehouseSchema.pre('save', function (next) {
  const parts = [
    this.location,
    this.zone,
    this.aisle,
    this.shelf,
    this.bin,
  ].filter(Boolean);
  
  this.fullLocation = parts.join(' / ');
  
  // Update available capacity
  this.availableCapacity = (this.capacity || 0) - (this.currentQuantity || 0);
  
  next();
});

// Method to add stock movement
warehouseSchema.methods.addMovement = async function (type, quantity, reference = null, notes = null, userId = null) {
  this.movements.push({
    date: new Date(),
    type,
    quantity,
    reference,
    notes,
    performedBy: userId,
  });
  
  // Update current quantity based on movement type
  switch (type) {
    case 'received':
      this.currentQuantity = (this.currentQuantity || 0) + quantity;
      break;
    case 'shipped':
    case 'damaged':
    case 'expired':
      this.currentQuantity = Math.max(0, (this.currentQuantity || 0) - quantity);
      break;
    case 'adjusted':
      this.currentQuantity = quantity;
      break;
    // transferred and returned don't change the count directly
  }
  
  // Update available capacity
  this.availableCapacity = (this.capacity || 0) - (this.currentQuantity || 0);
  
  // Update last count date for received movements
  if (type === 'received') {
    this.lastCountDate = new Date();
  }
  
  return this.save();
};

// Method to check if reorder is needed
warehouseSchema.methods.needsReorder = function () {
  return this.currentQuantity <= (this.minStockLevel || 0);
};

// Method to check if location is at capacity
warehouseSchema.methods.isFull = function () {
  return this.currentQuantity >= (this.capacity || 0);
};

// Static method to find optimal picking location
warehouseSchema.statics.findOptimalPickLocation = async function (tenantId, productId) {
  return this.findOne({
    tenant: tenantId,
    subProduct: productId,
    isActive: true,
    status: 'active',
  }).sort({ pickPriority: 1, currentQuantity: -1 });
};

// Indexes
warehouseSchema.index({ tenant: 1, subProduct: 1 }, { unique: true });
warehouseSchema.index({ tenant: 1, isActive: 1 });
warehouseSchema.index({ subProduct: 1, isActive: 1 });
warehouseSchema.index({ tenant: 1, zone: 1, aisle: 1, shelf: 1 });
warehouseSchema.index({ tenant: 1, status: 1 });
warehouseSchema.index({ tenant: 1, currentQuantity: 1 });

const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);

module.exports = Warehouse;
