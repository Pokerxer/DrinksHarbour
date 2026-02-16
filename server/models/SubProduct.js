// models/SubProduct.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const MediaItemSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  publicId: String,
  resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
  format: String,
  width: Number,
  height: Number,
  size: Number,
  thumbnail: String,
  uploadedBy: { type: ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  tags: [String],
  caption: String,
}, { _id: false });

const subProductSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE RELATIONSHIPS
    // ════════════════════════════════════════════════════════════
    product: {
      type: ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // COMMERCIAL DATA
    // ════════════════════════════════════════════════════════════
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    baseSellingPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    costPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    currency: {
      type: String,
      default: 'NGN',
      enum: ['NGN', 'USD', 'EUR', 'GBP', 'ZAR', 'KES', 'GHS'],
    },
    
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    marginPercentage: {
      type: Number,
      min: 0,
    },

    // SALE / DISCOUNT PRICING
    salePrice: {
      type: Number,
      min: 0,
    },
    
    saleStartDate: {
      type: Date,
    },
    
    saleEndDate: {
      type: Date,
    },
    
    saleType: {
      type: String,
      enum: ['percentage', 'fixed', 'flash_sale', 'bundle', 'bogo', null],
      default: null,
    },
    
    saleDiscountValue: {
      type: Number,
      min: 0,
    },
    
    saleBanner: {
      url: String,
      alt: String,
    },
    
    isOnSale: {
      type: Boolean,
      default: false,
    },

    // TENANT OVERRIDES
    // ════════════════════════════════════════════════════════════
    shortDescriptionOverride: {
      type: String,
      maxlength: 280,
    },
    descriptionOverride: {
      type: String,
      maxlength: 5000,
    },
    imagesOverride: [MediaItemSchema],
    customKeywords: [String],
    embeddingOverride: [Number],
    
    tenantNotes: {
      type: String,
      maxlength: 1000,
      // Internal notes about this product
    },

    // ════════════════════════════════════════════════════════════
    // VARIANT / SIZE LINKING
    // ════════════════════════════════════════════════════════════
    sizes: [{
      type: ObjectId,
      ref: 'Size',
    }],
    sellWithoutSizeVariants: {
      type: Boolean,
      default: false,
    },
    
    defaultSize: {
      type: ObjectId,
      ref: 'Size',
    },

    // ════════════════════════════════════════════════════════════
    // INVENTORY MANAGEMENT
    // ════════════════════════════════════════════════════════════
    stockStatus: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued'],
      default: 'in_stock',
      index: true,
    },
    
    totalStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    availableStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    
    reorderPoint: {
      type: Number,
      default: 5,
      min: 0,
    },
    
    reorderQuantity: {
      type: Number,
      default: 50,
      min: 1,
    },
    
    lastRestockDate: Date,
    nextRestockDate: Date,

    // ════════════════════════════════════════════════════════════
    // VENDOR & SOURCING
    // ════════════════════════════════════════════════════════════
    vendor: {
      type: ObjectId,
      sparse: true,
    },
    
    supplierSKU: String,
    supplierPrice: Number,
    leadTimeDays: Number,
    minimumOrderQuantity: Number,

    // ════════════════════════════════════════════════════════════
    // OPERATIONAL STATUS
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'low_stock', 'out_of_stock', 'discontinued', 'hidden', 'archived'],
      default: 'pending',
      index: true,
    },
    
    isFeaturedByTenant: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    
    addedAt: {
      type: Date,
      default: Date.now,
    },
    
    activatedAt: Date,
    deactivatedAt: Date,
    discontinuedAt: Date,

    // ════════════════════════════════════════════════════════════
    // PROMOTIONS & DISCOUNTS
    // ════════════════════════════════════════════════════════════
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage', null],
      default: null,
    },
    discountStart: Date,
    discountEnd: Date,
    
    flashSale: {
      isActive: { type: Boolean, default: false },
      startDate: Date,
      endDate: Date,
      discountPercentage: Number,
      remainingQuantity: Number,
    },
    
    bundleDeals: [{
      name: String,
      products: [{ type: ObjectId, ref: 'SubProduct' }],
      discount: Number,
      validUntil: Date,
    }],

    // ════════════════════════════════════════════════════════════
    // ANALYTICS & REPORTING
    // ════════════════════════════════════════════════════════════
    totalSold: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
    lastSoldDate: Date,
    
    forecastedDemand: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    demandForecast: {
      next7Days: Number,
      next30Days: Number,
      next90Days: Number,
      lastUpdated: Date,
    },
    
    salesVelocity: {
      type: Number,
      default: 0,
      // Units sold per day
    },
    
    turnoverRate: {
      type: Number,
      default: 0,
      // How quickly inventory sells
    },
    
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      // Percentage of views that convert to sales
    },
    
    viewCount: {
      type: Number,
      default: 0,
    },
    
    addToCartCount: {
      type: Number,
      default: 0,
    },
    
    purchaseCount: {
      type: Number,
      default: 0,
    },

    // ════════════════════════════════════════════════════════════
    // SEASONAL & TIME-BASED
    // ════════════════════════════════════════════════════════════
    seasonality: {
      spring: { type: Boolean, default: false },
      summer: { type: Boolean, default: false },
      fall: { type: Boolean, default: false },
      winter: { type: Boolean, default: false },
    },
    
    specialOccasions: [{
      type: String,
      enum: [
        'christmas', 'new_year', 'valentines', 'easter',
        'halloween', 'thanksgiving', 'mothers_day', 'fathers_day',
        'independence_day', 'black_friday', 'cyber_monday',
        'wedding', 'birthday', 'anniversary',
      ],
    }],

    // ════════════════════════════════════════════════════════════
    // SHIPPING & LOGISTICS
    // ════════════════════════════════════════════════════════════
    shipping: {
      weight: Number, // grams
      length: Number, // cm
      width: Number,  // cm
      height: Number, // cm
      fragile: { type: Boolean, default: true },
      requiresAgeVerification: { type: Boolean, default: true },
      hazmat: { type: Boolean, default: false },
      shippingClass: String,
    },
    
    warehouse: {
      location: String,
      zone: String,
      aisle: String,
      shelf: String,
      bin: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ════════════════════════════════════════════════════════════
// VIRTUALS
// ════════════════════════════════════════════════════════════

subProductSchema.virtual('effectiveSellingPrice').get(function () {
  // Calculate based on tenant revenue model
  return this.baseSellingPrice; // Simplified
});

subProductSchema.virtual('discountedPrice').get(function () {
  const now = new Date();
  if (!this.discount || !this.discountType || 
      (this.discountStart && now < this.discountStart) || 
      (this.discountEnd && now > this.discountEnd)) {
    return this.effectiveSellingPrice;
  }
  if (this.discountType === 'fixed') {
    return Math.max(0, this.effectiveSellingPrice - this.discount);
  } else if (this.discountType === 'percentage') {
    const discountAmount = this.effectiveSellingPrice * (this.discount / 100);
    return Math.max(0, this.effectiveSellingPrice - discountAmount);
  }
  return this.effectiveSellingPrice;
});

subProductSchema.virtual('profitMargin').get(function () {
  if (!this.baseSellingPrice || !this.costPrice) return 0;
  return ((this.baseSellingPrice - this.costPrice) / this.baseSellingPrice) * 100;
});

subProductSchema.virtual('isLowStock').get(function () {
  return this.availableStock > 0 && this.availableStock <= this.lowStockThreshold;
});

subProductSchema.virtual('needsReorder').get(function () {
  return this.availableStock <= this.reorderPoint;
});

// ════════════════════════════════════════════════════════════
// SALE / DISCOUNT VIRTUALS AND METHODS
// ════════════════════════════════════════════════════════════

subProductSchema.virtual('saleActive').get(function () {
  if (!this.salePrice || !this.isOnSale) return false;
  const now = new Date();
  if (this.saleStartDate && now < this.saleStartDate) return false;
  if (this.saleEndDate && now > this.saleEndDate) return false;
  return true;
});

subProductSchema.virtual('saleDiscountPercentage').get(function () {
  if (!this.isOnSale || !this.salePrice) return 0;
  if (this.saleType === 'fixed') {
    return ((this.baseSellingPrice - this.salePrice) / this.baseSellingPrice) * 100;
  }
  return this.saleDiscountValue || 0;
});

subProductSchema.virtual('displayPrice').get(function () {
  if (this.isOnSale && this.salePrice) {
    return this.salePrice;
  }
  return this.baseSellingPrice;
});

// Auto-update isOnSale before save
subProductSchema.pre('save', function () {
  if (this.salePrice && this.saleStartDate && this.saleEndDate) {
    const now = new Date();
    this.isOnSale = now >= this.saleStartDate && now <= this.saleEndDate;
  } else if (this.salePrice && !this.saleStartDate && !this.saleEndDate) {
    this.isOnSale = true;
  } else {
    this.isOnSale = false;
  }
});

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════

// subProductSchema.index({ tenant: 1, product: 1 }, { unique: true });
// subProductSchema.index({ tenant: 1, status: 1 });
// subProductSchema.index({ sku: 1 });
// subProductSchema.index({ sizes: 1 });
// subProductSchema.index({ tenant: 1, totalSold: -1 });
// subProductSchema.index({ tenant: 1, lastSoldDate: -1 });
// subProductSchema.index({ tenant: 1, isFeaturedByTenant: 1 });
// subProductSchema.index({ tenant: 1, stockStatus: 1 });
// subProductSchema.index({ vendor: 1, tenant: 1 });

const SubProduct = mongoose.models.SubProduct || mongoose.model('SubProduct', subProductSchema);
module.exports = SubProduct;